import React, {useEffect, useRef, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import MapView, {Marker, Polyline, Region} from 'react-native-maps';

import {Coordinates} from '../types/checkIn';
import {routeTracker} from '../services/routeTracker';

const initialRegion: Region = {
  latitude: 28.6139,
  longitude: 77.209,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};

function formatDirection(heading?: number) {
  if (heading === undefined) {
    return 'Direction pending';
  }

  const labels = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(heading / 45) % labels.length;
  return `${labels[index]} ${Math.round(heading)}°`;
}

export default function RouteMapScreen() {
  const mapRef = useRef<MapView>(null);
  const [points, setPoints] = useState<Coordinates[]>([]);
  const [status, setStatus] = useState('Waiting for location permission');
  const [isTracking, setIsTracking] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);

  useEffect(() => {
    return routeTracker.subscribe(snapshot => {
      setPoints(snapshot.points);
      setStatus(snapshot.status);
      setIsTracking(snapshot.isTracking);
    });
  }, []);

  useEffect(() => {
    if (!isMapReady || points.length === 0) {
      return;
    }

    const timeout = setTimeout(() => {
      mapRef.current?.fitToCoordinates(points, {
        edgePadding: {top: 80, right: 50, bottom: 150, left: 50},
        animated: true,
      });
    }, 250);

    return () => clearTimeout(timeout);
  }, [isMapReady, points]);

  const latest = points[points.length - 1];
  const directionLabel = formatDirection(latest?.heading);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={initialRegion}
        showsUserLocation
        onMapReady={() => setIsMapReady(true)}>
        {latest ? (
          <Marker
            coordinate={latest}
            rotation={latest.heading}
            title="Current location"
            description={directionLabel}
          />
        ) : null}
        {points.length > 1 ? (
          <Polyline coordinates={points} strokeColor="#1d6f61" strokeWidth={5} />
        ) : null}
      </MapView>
      <View style={styles.controls}>
        <View>
          <Text style={styles.status}>{status}</Text>
          <Text style={styles.meta}>{points.length} route points captured</Text>
          <Text style={styles.meta}>{directionLabel}</Text>
        </View>
        <Pressable
          style={isTracking ? styles.stopButton : styles.startButton}
          onPress={isTracking ? routeTracker.stop : routeTracker.start}>
          <Text style={styles.buttonText}>{isTracking ? 'Stop' : 'Start'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7f8',
  },
  map: {
    flex: 1,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#dce5e1',
  },
  status: {
    color: '#14322e',
    fontSize: 17,
    fontWeight: '800',
  },
  meta: {
    color: '#60736d',
    marginTop: 2,
  },
  startButton: {
    backgroundColor: '#1d6f61',
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  stopButton: {
    backgroundColor: '#c33d2f',
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '800',
  },
});
