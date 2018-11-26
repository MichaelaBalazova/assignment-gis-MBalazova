import psycopg2
import json
from flask import Flask, render_template
from psycopg2.extras import RealDictCursor


def connect_to_db():
    conn_string = 'host=localhost port=5432 dbname=london user=postgres'
    try:
        print("Connected to database -> %s !\n" % conn_string)
        return psycopg2.connect(conn_string)
    except:
        print("Can't connect to database")


app = Flask(__name__)


@app.route('/')
def hello():
    return render_template('template.html')


@app.route('/allCafes')
def get_all_cafes():
    conn = connect_to_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    try:
        cur.execute("""
        select 'FeatureCollection' as type, array_to_json(array_agg(attr)) as features from (
            select 'Feature' As type , st_asgeojson(way::geography)::json as geometry, 
            row_to_json((name,amenity)) as properties 
            from planet_osm_point 
            where amenity like 'cafe' and name is not null) 
            as attr ;
        """);
    except:
        print("Error executing select")

    return get_json_and_close_sess(cur, conn)


@app.route('/allShoppingMalls')
def get_all_shopping_malls():
    conn = connect_to_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    try:
        # created views for - all_cafes, all_malls, all_data (union all  all_cafes and all_malls)
        cur.execute("""
        select 'FeatureCollection' as type, array_to_json(array_agg(attr)) as features from (
            select 'Feature' as type, st_asgeojson(all_data.way)::json as geometry, 
            row_to_json((all_data.name, all_data.amenity, all_data.area)) as properties from all_data, all_malls
            where st_intersects(all_data.way,all_malls.way)  = 't' ) 
        as attr; 
        """);
    except:
        print("Error executing select")

    return get_json_and_close_sess(cur, conn)


@app.route('/findClosestCafes/<latlng>/<distance>')
def find_closest_cafes_on_click(latlng, distance):
    lng, lat = transform_lat_lng(latlng)

    conn = connect_to_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    try:
        sql_query = """
        select 'FeatureCollection' as type, array_to_json(array_agg(attr)) as features from (
            select 'Feature' as type, st_asgeojson(way::geography)::json as geometry, 
                row_to_json((name, st_distance(way::geography, 
                st_setsrid(st_makepoint( %s, %s ),4326)::geography))) as properties 
                from planet_osm_point
                where amenity = 'cafe' and 
                name is not null and 
                st_dwithin(way::geography, st_setsrid(st_makepoint( %s, %s ),4326)::geography, %s) )
        as attr ;
        """
        cur.execute(sql_query, (lng, lat, lng, lat, distance))
    except:
        print("Error executing select")

    return get_json_and_close_sess(cur, conn)


@app.route('/findOneClosestCafe/<latlng>')
def find_closest_cafe_and_road(latlng):
    lng, lat = transform_lat_lng(latlng)

    conn = connect_to_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    try:
        sql_query = """
        select 'FeatureCollection' as type, array_to_json(array_agg(attr)) as features from (
            select 'Feature' as type, st_AsGeoJSON(way::geography)::json as geometry, 
            row_to_json((name, ST_Distance(way::geography, ST_SetSRID(ST_MakePoint( %s, %s ),4326)::geography))) as properties 
            from planet_osm_point 
            where amenity = 'cafe' and name is not null 
            order by ST_Distance(way::geography, ST_SetSRID(ST_MakePoint( %s, %s),4326)::geography) asc limit 1 ) 
        as attr ; 
        """
        cur.execute(sql_query, (lng, lat, lng, lat,))
    except:
        print("Error executing select")

    return get_json_and_close_sess(cur, conn)


@app.route('/findRoadAndCafes/<latlng>')
def find_road_and_cafes(latlng):
    lng, lat = transform_lat_lng(latlng)

    conn = connect_to_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    try:
        sql_query = """
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
        """
        cur.execute(sql_query, (lng, lat, lng, lat,))
    except:
        print("Error executing select")

    return get_json_and_close_sess(cur, conn)


def get_json_and_close_sess(cur, conn):
    json_str = json.dumps(cur.fetchall())

    print(json_str)

    cur.close()
    conn.close()

    return json_str


def transform_lat_lng(lat_lng):
    # latLng = LatLng(51.5128, -0.11158)
    # return = just numbers, changed order (lng, lat)
    new_str = lat_lng.replace("LatLng(", "").replace(")", "")
    lat, lng = new_str.split(", ")
    return float(lng), float(lat)


if __name__ == '__main__':
    app.run()
