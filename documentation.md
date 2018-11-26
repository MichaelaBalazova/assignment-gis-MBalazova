# Dokumentácia projektu

**Application description**: Aplikácia pre vyhľadávanie kaviarní v Londýne

**Data source**: `open street maps`

**Technologies used**: `python, flask, javascript, jquery, bootstrap, leaflet, mapbox`

### Opis domény

Pre svoju aplikáciu som si vybrala vyhľadávanie kaviarní vo veľkom meste, ako je Londýn. Na mape si vieme zobraziť aj všetky kaviarne spolu s ich názvom alebo si viem kaviarne rôzne filtrovať podľa nižšie popísaných scenárov.

### Frontend 

Frontendová aplikácia zobrazuje statickú HTML stránku `template.html`, ktorej štýl je definovaný bootstrap-om a externým súborom `style.css`. 

Pre lepší vzhľad mapy a viditeľnejšie kaviarne (názov kaviarne a ikona) som použila ```mapbox``` vrstvu, ktorá zvýraznila na základe podmienky požadované zariadenia. Keďže sa jedná o veľmi dynamické odvetvie (zánik a vznik kaviarní je úplne bežný), tak dáta nie sú v každom prípade konzistentné. Tento fakt prisudzujeme neaktuálnosti datasetu. 
Vzhľad mapy som si upravila na `light` a tiež som si zmenila napr. farby parkov alebo riek, vodných plôch.

### Backend 

Backendová aplikácia je napísaná vo framework-u Flask a jazyku Python. Táto časť je zodpovedná za všetky dopyty z geo databázy.

### Opis scenárov + príklady query

#### Scenár 1 - nákupné centrá

Zobrazenie všetkých nákupných centier v Londýne a kaviarne, ktoré sa v týchto centrách nachádzajú. V detaile nákupného centra je zobrazená aj plocha budovy.

Na začiatku som si vybrala všetky nákupné centrá a všetky kaviarne. V druhom selecte som pomocou UNION ALL spojila tieto údaje a kontrolovala som ich prienik. Nakoniec som si na mape zobrazila všetky nákupné centrá spolu s kaviarňami, ktoré sa nachádzali v niektorým z nich.

V detaile nákupného centra zobrazujem aj jeho plochu v metroch štvrcových, čo umožňuje funkcia `ST_Area`.

použité postgis funkcie : `ST_Intersects, ST_Area`

**API** : `GET /allShoppingMalls`

príprava:
```sql
create view all_malls as (select name,way,st_area(way::geography) as area,shop as amenity 
	from planet_osm_polygon where shop like 'mall' and name is not null) 

create view all_cafes as (select name,way,st_area(way::geography) as area,amenity 
	from planet_osm_point where amenity like 'cafe' and name is not null)

create view all_data as (select * from all_malls
	union all
	select * from all_cafes)    
```

SQL:
```sql
select 'FeatureCollection' as type, array_to_json(array_agg(attr)) as features from (
    select 'Feature' as type, st_asgeojson(all_data.way)::json as geometry, 
    row_to_json((all_data.name, all_data.amenity, all_data.area)) as properties from all_data, all_malls
    where st_intersects(all_data.way,all_malls.way)  = 't' ) 
as attr; 
```

#### Scenár 2 - najbližšia kaviareň

Nájdenie jednej najbližšej kaviarne k aktuálnej polohe na mape.

V tomto dopyte som si zistila vzdialenosť od bodu na mape ku každej kaviarni, následne som si tieto dáta zoradila od najmenšej vzdialenosti, ktorú som nakoniec zobrazila aj na mape ako najbližšiu kaviareň (v detaile zobrazujem aj konkrétnu vzdialenosť v metroch).

použité postgis funkcie : `ST_Distance`

**API** : `GET /findOneClosestCafe/LatLng(51.5617,%20-0.03543)`

SQL:
```sql
select 'FeatureCollection' as type, array_to_json(array_agg(attr)) as features from (
    select 'Feature' as type, st_AsGeoJSON(way::geography)::json as geometry, 
    row_to_json((name, ST_Distance(way::geography, ST_SetSRID(ST_MakePoint( %s, %s ),4326)::geography))) as properties 
    from planet_osm_point 
    where amenity = 'cafe' and name is not null 
    order by ST_Distance(way::geography, ST_SetSRID(ST_MakePoint( %s, %s),4326)::geography) asc limit 1 ) 
as attr ; 
```

#### Scenár 3 - okruh kaviarní

Nájdenie najbližších kaviarní v okruhu x metrov od určenej polohy na mape. Používateľ si môže zvoliť požadovanú vzdialenosť v metroch.

Pomocou funkcie `ST_DWithin` si zobrazujem kaviarne, ktoré sú v okruhu x metrov od zvolenej pozície a pri popupe bodu, ktorý sa ukazuje v detaile zobrazujem názov kaviarne a tiež jej vzdialenosť. 

Na základe dokumentácie PostGis je funkcia `ST_DWithin` efektívnejšia ako `ST_Distance` od verzie 1.3.4.

použité postgis funkcie : `ST_DWithin, ST_Distance`

**API** : `GET /findClosestCafes/LatLng(51.52336,%20-0.14255)/1000`

SQL:
```sql
select 'FeatureCollection' as type, array_to_json(array_agg(attr)) as features from (
    select 'Feature' as type, st_asgeojson(way::geography)::json as geometry, 
        row_to_json((name, st_distance(way::geography, 
        st_setsrid(st_makepoint( %s, %s ),4326)::geography))) as properties 
        from planet_osm_point
        where amenity = 'cafe' and 
        name is not null and 
        st_dwithin(way::geography, st_setsrid(st_makepoint( %s, %s ),4326)::geography, %s) )
as attr ;
```

#### Scenár 4 - kaviarne na jednej ulici

Zobrazenie ulice na základe zadanej polohy na mape a kaviarní, ktoré sa na tejto ulici nachádzajú. V detaile ulice môžeme vidieť aj jej celkovú dĺžku.

Pri tejto funkcií bolo zobrazenie celistvej ulice zdĺhavejšie. Keďže jedna ulica sa v DB skladá z viacerých línií, tak som sa snažila nájsť najprv najbližšiu líniu (kde označenie highway nebolo null alebo to nebola len pešia cesta) k zadanému miestu na mape. Následne som hľadala iné línie, ktoré mali ten istý názov a zobrazovala som všetky tieto časti. 

V ďalšom kroku som zobrazila kaviarne, ktoré boli vo veľmi blízkej vzdialenosti od všetkých nájdených čiastkových línií. V tomto prípade sa neosvedčila funckia ST_Contains alebo ST_Intersects, keďže bod by musel ležať priamo na priamke, aby sa táto funkcia vyhodnotila ako pravdivá. 

V poslednom kroku mojim cieľom bolo zistiť celkovú dĺžku ulice. V tomto prípade som znova musela ísť na to čiastkovo a zistiť si dĺžku pre každú časť ulice (`ST_Length`) a následne ich spolu sčítať. 

použité postgis funkcie : `ST_Length, ST_DWithin, ST_Distance`

**API** : `GET /findRoadAndCafes/LatLng(51.52336,%20-0.09174)`

príprava:
```sql
create view all_cafes_with_sum as (select name,way,amenity,0 as sumlength 
	from planet_osm_point where amenity like 'cafe' and name is not null)
```

SQL:
```sql
with roads as (select name from planet_osm_line 
	where ST_DWithin(ST_SetSRID(st_makepoint( %s, %s ),4326)::geography, way::geography, 30) 
	and highway is not null and highway != 'footway'
	order by st_distance(way::geography,  st_setsrid(st_makepoint( %s, %s ),4326)::geography) asc limit 1),

allroads as (select name,way::geography,highway as amenity,st_length(way::geography) as length
	from planet_osm_line where name = (select name from roads)),

allroadswithlength as (select name,way::geography,amenity,(select sum(length) 
	from allroads) as sumlength 
	from allroads),                                              

cafes as (select all_cafes_with_sum.name,all_cafes_with_sum.way,all_cafes_with_sum.amenity,all_cafes_with_sum.sumlength 
          from all_cafes_with_sum, allroadswithlength 
          where ST_DWithin(all_cafes_with_sum.way,allroadswithlength.way, 30))
            
select 'FeatureCollection' as type, array_to_json(array_agg(attr)) as features from (
    select 'Feature' as type, st_asgeojson(alldata.way)::json as geometry, 
    row_to_json((alldata.name, alldata.amenity, alldata.sumlength)) as properties from (
        select * from allroadswithlength
        union all
        select * from cafes
    ) as alldata ) 
as attr; 
```

##### Príklad odpovede

JSON:
```json
[
    {"type": "FeatureCollection", 
        "features": [
            {"type": "Feature", 
            "geometry": {
                "type": "Point", 
                "coordinates": [-0.0466213, 51.5570747991651]}, 
                "properties": {"f1": "Cooper & Wolf", "f2": 931.21915733}
            }
        ]
    }
]
```

### Informácie o dátach v databáze, indexy 

Vo svojom projekte som pracovala s dátami z ```open street maps```, konkrétne som si vybrala mesto Londýn (hľadiac na hustotu kaviarní a veľkosť plochy). Na tejto ploche sa nachádzalo viac ako 2700 kaviarní.

Pri vytváraní indexov som sledovala ako vytvorené indexy pomohli dopytu, čo sa týka či už časového hľadiska zo strany používateľa alebo pomocou príkazu ```EXPLAIN SELECT ...```

Dáta som si dala do 4326 projekcie, aby som ich nemusela pri každom dopyte transformovať.

```sql
ALTER TABLE planet_osm_point
	ALTER COLUMN way TYPE geometry(LineString, 4326) USING ST_Transform(way, 4326) ;
ALTER TABLE planet_osm_line
	ALTER COLUMN way TYPE geometry(Point, 4326) USING ST_Transform(way, 4326) ;
ALTER TABLE planet_osm_polygon
	ALTER COLUMN way TYPE geometry(Geometry, 4326) USING ST_Transform(way, 4326) ;		
```

Pri niektorých dopytoch som si vytvorila views, najmä pre sprehľadnenie. 
Indexy boli vytvorené nad stĺpcami, ktoré sa používajú pri väčšine dopytov :
- stĺpec amenity, kde je vyznačené, ak sa jedná o kaviareň pri tabuľke bodov
- meno kaviarne, ktoré sa zobrazuje vždy v popupe
- stĺpec na základe ktorého vyhľadávame nákupné centrá v tabuľke polygónov
- stĺpec na základe ktorého vyhľadávame ulice v tabuľke ciest
- stĺpec na základe ktorého vyhľadávame mená ulíc v tabuľke ciest

```sql
CREATE INDEX index_amenity_planet_osm_point ON planet_osm_point(amenity);
CREATE INDEX index_name_planet_osm_point ON planet_osm_point(name);

CREATE INDEX index_shop_planet_osm_polygon ON planet_osm_polygon(shop);

CREATE INDEX index_highway_planet_osm_line ON planet_osm_line(highway);
CREATE INDEX index_name_planet_osm_line ON planet_osm_line(name);
```

Vytvorila som si aj geo indexy nad stĺpcom obsahujúcim súradnice, čo značne urýchlilo dopyty.

```sql
create index index_gist_way_planet_osm_point on planet_osm_point using gist(geography(way));
create index index_gist_way_planet_osm_line on planet_osm_line using gist(geography(way));
create index index_gist_way_planet_osm_polygon on planet_osm_polygon using gist(geography(way));
```

### Screenshot z aplikácie

Znázornenie aktuálnej polohy sa určuje pomocou kliknutia do mapy a zobrazenia popup-u "Here I am!". Ak používateľ nemá zvolenú polohu na mape, aplikácia ho upozorní.  

Nasledujúci screenshot z aplikácie zobrazuje scenár č.3 - zobrazenie kaviarní v okruhu x metrov.
Pri kliknutí na nájdené body sa nám zobrazí detail kaviarne - jej názov a vzdialenosť od zadaného bodu.
Na pravej strane je menu, kde si môžeme nastaviť vzdialenosť okruhu, do ktorého chceme hľadať kaviarne. Prednastavená je vzdialenosť 1km (1000m).

![alt text](https://github.com/MichaelaBalazova/PDT_cafes/blob/master/screenshots/screen1.png "scenar3")

Pri tomto screenshote sa nám zobrazuje scenár č.4 - zobrazenie ulice a kaviarní na nej / v jej blízkosti.
Používateľ si najprv pomocou zadania polohy určí ulicu, na ktorej chce kaviarne hľadať. Aplikácia mu zobrazí celú ulicu, ktorá sa skladá z viacerých častí. V detaile ulice môžeme vidieť o aký typ cesty sa jedná (primárna, sekundárna...) a tiež jej celkovú dĺžku.
V jej okolí sú zobrazené kaviarne, ktoré sa tu nachádzajú spolu s detailom kaviarne po kliknutí na jej bod.

![alt text](https://github.com/MichaelaBalazova/PDT_cafes/blob/master/screenshots/screen2.png "scenar4")

Na nasledujúci obrázkoch je znázorený scenár č.1 - zobrazenie všetkých nákupných centier a kaviarní, ktoré sa v nich nachádzajú.
V tomto prípade v detaile nákupného entra zobrazujeme aj celkovú plochu budovy.

![alt text](https://github.com/MichaelaBalazova/PDT_cafes/blob/master/screenshots/screen3.png "scenar1-1")
![alt text](https://github.com/MichaelaBalazova/PDT_cafes/blob/master/screenshots/screen4.png "scenar1-2")


