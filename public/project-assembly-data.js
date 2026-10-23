// Coordinates are percentages of the source screenshot. Each project follows its
// own content hierarchy; the remaining pixels form the supporting page plate.
export const assemblyDesigns = {
  rpk: {
    width: 1440, height: 1000, paper: '#080808',
    pieces: [
      { name: 'Brand and signature', rect: [3.9, 2.1, 22.2, 5], from: [-12, -5, -2] },
      { name: 'Main navigation', rect: [38.5, 3.2, 34.8, 3], from: [0, -9, 0] },
      { name: 'Header inquiry', rect: [84.4, 2.3, 11.5, 4.6], from: [12, -4, 2] },
      { name: 'Hero headline', rect: [4.1, 30.5, 42, 16.1], from: [-16, 1, -2] },
      { name: 'Company introduction', rect: [4.1, 49.5, 42, 12.3], from: [-12, 5, -1] },
      { name: 'Production principles', rect: [4.1, 64.7, 22.5, 2.4], from: [-8, 9, 0] },
      { name: 'Hero actions', rect: [4.1, 69.6, 30.9, 5.5], from: [-8, 13, 1] },
      { name: 'Facade brand sign', rect: [66.7, 34.4, 29.4, 25.3], from: [16, 4, 3] },
      { name: 'Production advantages', rect: [4.1, 84.8, 91.8, 12.6], from: [0, 15, 0] }
    ],
    source: { src: 'assets/assembly/rpk.webp', rect: [0, 19.8, 100, 65], fit: 'cover' }
  },
  ankor: {
    width: 1440, height: 1000, paper: '#fafaf4',
    pieces: [
      { name: 'Brand announcement', rect: [0, 0, 100, 3.5], from: [0, -7, 0] },
      { name: 'Ankor logo', rect: [3.8, 5, 10.2, 6.3], from: [-10, -4, -2] },
      { name: 'Navigation and contact', rect: [29.8, 6.8, 66.5, 3.5], from: [10, -5, 1] },
      { name: 'Nature headline', rect: [5.4, 18.7, 30, 21.5], from: [-15, 1, -2] },
      { name: 'Brand story', rect: [5.4, 43, 26.5, 8], from: [-10, 5, -1] },
      { name: 'Product actions', rect: [5.4, 54, 22, 5.8], from: [-6, 11, 1] },
      { name: 'Research experience', rect: [5.4, 67.1, 23.4, 4.5], from: [-8, 13, -1] },
      { name: 'Renova product photograph', rect: [50, 12.9, 48.3, 62.6], from: [17, 3, 2] },
      { name: 'Natural product benefits', rect: [5.4, 78.6, 89, 7.1], from: [0, 15, 0] }
    ],
    source: { src: 'assets/assembly/ankor.webp', rect: [50, 12.9, 48.3, 62.6], fit: 'cover' }
  },
  saf: {
    width: 1440, height: 900, paper: '#ffffff',
    pieces: [
      { name: 'Sensata and SAF navigation', rect: [0, 0, 100, 7], from: [0, -9, 0] },
      { name: 'Project name', rect: [1.7, 9.5, 10.4, 6], from: [-12, -3, -2] },
      { name: 'Apartment filter action', rect: [87.4, 10, 11, 5], from: [12, -3, 2] },
      { name: 'City panorama', rect: [0, 20, 100, 24], from: [0, -10, 0] },
      { name: 'Residential complex', poly: [[18, 54], [33, 45], [55, 46], [68, 53], [80, 52], [80, 77.7], [18, 77.7]], from: [8, 13, 2] },
      { name: 'Building section selector', rect: [1.7, 79.1, 52, 8], from: [-14, 8, -1] },
      { name: 'Plan and visualization switch', rect: [1.7, 88.6, 25.3, 5.8], from: [-10, 11, -2] },
      { name: 'Selection guidance', rect: [1.7, 94.6, 19.3, 3.2], from: [0, 12, 0] },
      { name: 'Apartment catalogue shortcut', rect: [91.8, 87.2, 7.3, 11.2], from: [10, 10, 3] }
    ],
    source: { src: 'assets/assembly/saf.jpeg', rect: [0, 7, 100, 93], fit: 'cover' }
  },
  lesa: {
    width: 1440, height: 1000, paper: '#ffffff',
    pieces: [
      { name: 'Company logo', rect: [7.7, 1.7, 16.1, 4.9], from: [-11, -4, -2] },
      { name: 'Catalogue navigation', rect: [32.5, 2.7, 26.3, 3.5], from: [0, -8, 0] },
      { name: 'Contacts and estimate', rect: [59.6, 1.8, 32.4, 5], from: [12, -4, 2] },
      { name: 'Scaffold structure', rect: [49, 8.8, 51, 64.9], from: [18, 3, 2] },
      { name: 'Equipment headline', rect: [8, 16.8, 40.8, 27.2], from: [-17, 0, -2] },
      { name: 'Equipment introduction', rect: [8, 47, 32.8, 6.3], from: [-12, 5, -1] },
      { name: 'Catalogue and configurator actions', rect: [8, 56.3, 32.2, 10.7], from: [-7, 12, 1] },
      { name: 'Equipment specifications', rect: [0, 73.7, 100, 10.2], from: [0, 14, 0] },
      { name: 'Equipment catalogue introduction', rect: [0, 83.9, 100, 16.1], from: [0, 18, 0] }
    ],
    source: { src: 'assets/assembly/lesa.webp', rect: [0, 8.8, 100, 64.9], fit: 'cover' }
  },
  killdez: {
    width: 1440, height: 1000, paper: '#f2efe8',
    pieces: [
      { name: 'Brand navigation', rect: [0, 0, 100, 8.8], from: [0, -9, 0] },
      { name: 'Skullbug mascot', rect: [56, 15.3, 39, 57.7], from: [17, 1, 3] },
      { name: 'Pest control headline', rect: [6.8, 22.8, 37.8, 22.6], from: [-17, 1, -3] },
      { name: 'Service introduction', rect: [6.8, 46.5, 32, 9], from: [-11, 5, -1] },
      { name: 'Treatment estimate action', rect: [6.8, 58.2, 20.5, 5.8], from: [-7, 12, 2] },
      { name: 'Service carousel navigation', rect: [0, 74.9, 100, 9.9], from: [7, 12, 1] },
      { name: 'Service guarantees', rect: [0, 84.8, 100, 13.4], from: [0, 16, 0] }
    ],
    source: { src: 'assets/assembly/killdez.webp', rect: [56, 15.3, 39, 57.7], fit: 'contain' }
  },
  patrol: {
    width: 1440, height: 1000, paper: '#090a05',
    pieces: [
      { name: 'Patrol application header', rect: [14.4, 0, 71.2, 7.6], from: [0, -9, 0] },
      { name: 'Offroad vehicle', rect: [17, 10, 66, 22.2], from: [14, -5, 2] },
      { name: 'Security control', rect: [17, 33.1, 32.6, 13], from: [-13, 1, -2] },
      { name: 'Ignition control', rect: [50.4, 33.1, 32.5, 13], from: [13, 1, 2] },
      { name: 'Vehicle telemetry', rect: [17, 47.2, 65.9, 5.8], from: [10, 6, 1] },
      { name: 'Equipment shortcuts', rect: [17, 54.1, 65.9, 7.7], from: [-10, 9, -1] },
      { name: 'Connection and parking status', rect: [17, 62.9, 65.9, 15.9], from: [0, 13, 1] },
      { name: 'Smart automations', rect: [16.1, 80.8, 67.8, 10.9], from: [-9, 15, -2] },
      { name: 'Application navigation', rect: [14.4, 91.7, 71.2, 8.3], from: [0, 18, 0] }
    ],
    source: { src: 'assets/assembly/patrol.png', rect: [17, 10, 66, 22.2], fit: 'cover' }
  },
  aral: {
    width: 1440, height: 1000, paper: '#060911',
    pieces: [
      { name: 'Drive Forum announcement', rect: [0, 0, 100, 2.9], from: [0, -7, 0] },
      { name: 'Festival brand', rect: [7, 4.3, 13.4, 8], from: [-12, -3, -2] },
      { name: 'Festival navigation', rect: [21.3, 4.3, 72, 8], from: [12, -4, 1] },
      { name: 'Event distinction', rect: [28.4, 16.7, 43.2, 4.3], from: [0, -11, 0] },
      { name: 'Aral Dune headline', rect: [23, 23.6, 54, 18.8], from: [-12, 0, -2] },
      { name: 'Festival introduction', rect: [27.3, 44.4, 45.2, 7.8], from: [12, 5, 1] },
      { name: 'Participation and route actions', rect: [34.4, 56.3, 31.2, 7.6], from: [0, 12, -1] },
      { name: 'Festival countdown', rect: [23.3, 68.6, 53.4, 12.5], from: [13, 10, 2] },
      { name: 'Festival feature cards', rect: [14.4, 85.8, 71.2, 14.2], from: [0, 17, 0] }
    ],
    source: { src: 'assets/assembly/aral.png', rect: [0, 13.6, 100, 86.4], fit: 'cover' }
  },
  'saf-landing': {
    width: 1440, height: 1000, paper: '#ffffff',
    pieces: [
      { name: 'Property brand navigation', rect: [0, 0, 100, 6], from: [0, -9, 0] },
      { name: 'Central residential building', poly: [[36.7, 12.7], [49, 6], [58, 6], [71.6, 15.1], [71.6, 30.8], [75.4, 32.1], [75.4, 69.6], [35.8, 69.6]], from: [9, 14, 2] },
      { name: 'Right residential building', rect: [75.4, 6, 24.6, 63.6], from: [17, 4, 2] },
      { name: 'Private living headline', rect: [3.2, 10, 31, 13], from: [-15, 0, -2] },
      { name: 'Property specifications', rect: [0, 69.6, 100, 8.5], from: [0, 14, 0] },
      { name: 'Architecture image and brochure', rect: [9.7, 84, 48, 16], from: [-14, 12, -2] },
      { name: 'Property introduction', rect: [58.2, 85.2, 30.8, 14.8], from: [13, 12, 1] },
      { name: 'Available properties shortcut', rect: [89.5, 85.2, 9.5, 13], from: [10, 14, 3] }
    ],
    source: { src: 'assets/assembly/saf-landing.jpeg', rect: [0, 6, 100, 63.6], fit: 'cover' }
  },
  'dis-cleaning': {
    width: 1440, height: 1000, paper: '#ffffff',
    pieces: [
      { name: 'Cleaning brand navigation', rect: [0, 0, 100, 8.4], from: [0, -9, 0] },
      { name: 'Living room and mountain view', poly: [[70, 8.4], [100, 8.4], [100, 87.5], [53.5, 87.5], [53.5, 53.8], [67.7, 44.8], [70, 44.8]], from: [17, 3, 2] },
      { name: 'Clean space headline', rect: [8.8, 25.6, 60.5, 18.8], from: [-17, 0, -2] },
      { name: 'Cleaning service introduction', rect: [9, 47.4, 35, 5.3], from: [-11, 5, -1] },
      { name: 'Service selection action', rect: [9, 56.2, 13, 5.8], from: [-6, 12, 2] },
      { name: 'Contact and carousel controls', rect: [6.9, 79.4, 34.3, 8.1], from: [-11, 13, -1] },
      { name: 'Cleaning service guarantees', rect: [0, 87.5, 100, 9.3], from: [0, 16, 0] }
    ],
    source: { src: 'assets/assembly/dis-cleaning.jpg', rect: [0, 8.4, 100, 79.1], fit: 'cover' }
  }
};
