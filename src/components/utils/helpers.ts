import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import VectorSource from 'ol/source/Vector';
import VectorLayer from 'ol/layer/Vector';
import { Coordinate } from 'ol/coordinate';
import LineString from 'ol/geom/LineString';
import { Circle, Stroke, Style, Fill } from 'ol/style';

interface SingleData {
  latitude: number;
  longitude: number;
  hash_id: string;
  [key: string]: any;
}

export const createPoint = (lonlat: Coordinate) => {
  const pointFeature = new Feature(new Point(lonlat).transform('EPSG:4326', 'EPSG:3857'));
  pointFeature.setStyle(
    new Style({
      image: new Circle({
        radius: 3,
        fill: new Fill({ color: 'rgba(255,165,0,0.1)' }),
      }),
    })
  );

  return pointFeature;
};

export const createLines = (lonlat: Coordinate[], percent: number[]) => {
  const tmp: Feature[] = [];
  for (let i = 0; i < lonlat.length - 1; i++) {
    const line = new Feature(new LineString([lonlat[i], lonlat[i + 1]]).transform('EPSG:4326', 'EPSG:3857'));
    line.setStyle(
      new Style({
        stroke: new Stroke({
          color: `rgba(255,165,0,${(1 - percent[i]) * 0.1})`,
        }),
      })
    );
    tmp.push(line);
  }
  return tmp;
};

export const processData = (data: SingleData[]) => {
  data.reverse();
  const perDeviceRoute: { [key: string]: [number, number][] } = {};
  const perDeviceTime: { [key: string]: number[] } = {};

  data.map((datum) => {
    if (perDeviceRoute[datum.hash_id]) {
      perDeviceRoute[datum.hash_id].push([datum.longitude, datum.latitude]);
      perDeviceTime[datum.hash_id].push(datum.timestamp);
    } else {
      perDeviceRoute[datum.hash_id] = [[datum.longitude, datum.latitude]];
      perDeviceTime[datum.hash_id] = [datum.timestamp];
    }
  });

  const duration_hash: { [key: string]: number[] } = {};

  Object.keys(perDeviceTime).map((hash) => {
    if (perDeviceTime[hash].length == 1) {
      duration_hash[hash] = [];
      return;
    }

    duration_hash[hash] = perDeviceTime[hash].slice(1).map((n, i) => n - perDeviceTime[hash][i]);
  });

  const all_durations = Object.values(duration_hash)
    .flat()
    .filter((n) => n != 0);

  if (all_durations.length == 0) {
    return new VectorLayer({
      source: new VectorSource({
        features: [],
      }),
      zIndex: 2,
    });
  }

  const min = Math.log10(Math.min(...all_durations));
  const max = Math.log10(Math.max(...all_durations));
  const range = max - min == 0 ? 1 : max - min;

  const all_features: Feature[] = [];
  Object.keys(perDeviceRoute).map((hash_id) => {
    if (perDeviceRoute[hash_id].length == 1) {
      all_features.push(createPoint(perDeviceRoute[hash_id][0]));
    }

    all_features.push(
      ...createLines(
        perDeviceRoute[hash_id],
        duration_hash[hash_id].map((n) => (Math.log10(n) - min) / range)
      )
    );
  });

  return new VectorLayer({
    source: new VectorSource({
      features: all_features,
    }),
    zIndex: 2,
  });
};
