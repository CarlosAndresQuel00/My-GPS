import { AngularFirestore, AngularFirestoreCollection } from '@angular/fire/compat/firestore';
import { Component, ElementRef, ViewChild } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Observable } from 'rxjs';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { map } from 'rxjs/operators';

import { Plugins } from '@capacitor/core';
// eslint-disable-next-line @typescript-eslint/naming-convention
const { Geolocation } = Plugins;

declare let google;

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage {
  @ViewChild('map') mapElement: ElementRef;

  // Firebase Data
  locations: Observable<any>;
  locationsCollection: AngularFirestoreCollection<any>;

  // Map related
  map: any;
  markers = [];

  // Misc
  isTracking = false;
  watch: string;
  user = null;

  constructor(private afAuth: AngularFireAuth, private afs: AngularFirestore) {
    this.anonLogin();
  }

  ionViewWillEnter() {
    this.loadMap();
  }

  // Perform an anonymous login and load data
  anonLogin() {
    this.afAuth.signInAnonymously().then(res => {
      this.user = res.user;

      this.locationsCollection = this.afs.collection(
        `locations/${this.user.uid}/track`,
        ref => ref.orderBy('timestamp')
      );

      // Make sure we also get the Firebase item ID!
      this.locations = this.locationsCollection.snapshotChanges().pipe(
        map(actions =>
          actions.map(a => {
            const data = a.payload.doc.data();
            const id = a.payload.doc.id;
            return { id, ...data };
          })
        )
      );

      // Update Map marker on every change
      this.locations.subscribe(locations => {
        this.updateMap(locations);
      });
    });
  }

  // Initialize a blank map
  loadMap() {
    const latLng = new google.maps.LatLng(51.9036442, 7.6673267);

    const mapOptions = {
      center: latLng,
      zoom: 5,
      mapTypeId: google.maps.MapTypeId.ROADMAP
    };

    this.map = new google.maps.Map(this.mapElement.nativeElement, mapOptions);
    console.log('Map: ', this.map);
  }

  // Use Capacitor to track our geolocation
  startTracking() {
    this.isTracking = true;
    this.watch = Geolocation.watchPosition({}, (position, err) => {
      if (position) {
        this.addNewLocation(
          position.coords.latitude,
          position.coords.longitude,
          position.timestamp
        );
      }
    });
  }

  // Unsubscribe from the geolocation watch using the initial ID
  stopTracking() {
    Geolocation.clearWatch({ id: this.watch }).then(() => {
      this.isTracking = false;
    });
  }

  // Save a new location to Firebase and center the map
  addNewLocation(lat, lng, timestamp) {
    this.locationsCollection.add({
      lat,
      lng,
      timestamp
    });

    const position = new google.maps.LatLng(lat, lng);
    this.map.setCenter(position);
    this.map.setZoom(5);
  }

  // Delete a location from Firebase
  deleteLocation(pos) {
    this.locationsCollection.doc(pos.id).delete();
  }

  // Redraw all markers on the map
  updateMap(locations) {
    // Remove all current marker
    this.markers.map(marker => marker.setMap(null));
    this.markers = [];

    for (const loc of locations) {
      const latLng = new google.maps.LatLng(loc.lat, loc.lng);

      const marker = new google.maps.Marker({
        map: this.map,
        animation: google.maps.Animation.DROP,
        position: latLng
      });
      this.markers.push(marker);
    }
  }
}
