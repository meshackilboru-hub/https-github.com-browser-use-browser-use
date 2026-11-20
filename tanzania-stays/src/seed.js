// Sample properties so the site works out of the box. These are fictional
// placeholders, not real businesses; replace them with your partner listings
// (POST /api/listings with ADMIN_TOKEN, or edit data/db.json).
export const SEED_LISTINGS = [
  {
    id: 'stone-town-courtyard', name: 'Courtyard House Stone Town', type: 'hotel',
    region: 'Zanzibar', town: 'Stone Town', scene: 'coast', pricePerNight: 185000, units: 6, maxGuests: 3,
    amenities: ['Rooftop terrace', 'Breakfast', 'Wi-Fi', 'Air conditioning'],
    description: 'Restored coral-stone house a short walk from Forodhani Gardens and the seafront.',
  },
  {
    id: 'nungwi-beach-lodge', name: 'Nungwi Sands Lodge', type: 'lodge',
    region: 'Zanzibar', town: 'Nungwi', scene: 'coast', pricePerNight: 260000, units: 4, maxGuests: 4,
    amenities: ['Beachfront', 'Pool', 'Restaurant', 'Snorkel gear'],
    description: 'Thatched bandas on the northern tip of Unguja, steps from the sunset beach.',
  },
  {
    id: 'arusha-city-apartments', name: 'Arusha Central Apartments', type: 'apartment',
    region: 'Arusha', town: 'Arusha', scene: 'mountain', pricePerNight: 120000, units: 5, maxGuests: 4,
    amenities: ['Full kitchen', 'Wi-Fi', 'Parking', 'Washer'],
    description: 'Two-bedroom apartments with views of Mount Meru, ideal before a safari.',
  },
  {
    id: 'moshi-kili-view', name: 'Kili View Guest Lodge', type: 'lodge',
    region: 'Kilimanjaro', town: 'Moshi', scene: 'mountain', pricePerNight: 145000, units: 8, maxGuests: 3,
    amenities: ['Mountain view', 'Garden', 'Breakfast', 'Trek briefings'],
    description: 'Quiet garden lodge facing Kibo peak, a favourite base for Kilimanjaro climbers.',
  },
  {
    id: 'serengeti-tented-camp', name: 'Seronera Plains Tented Camp', type: 'lodge',
    region: 'Mara', town: 'Serengeti', scene: 'savanna', pricePerNight: 690000, units: 3, maxGuests: 2,
    amenities: ['Full board', 'Game drives', 'Solar power', 'Campfire'],
    description: 'Canvas suites on the open plains in the path of the Great Migration.',
  },
  {
    id: 'dar-masaki-suites', name: 'Masaki Harbour Suites', type: 'apartment',
    region: 'Dar es Salaam', town: 'Masaki', scene: 'city', pricePerNight: 210000, units: 7, maxGuests: 4,
    amenities: ['Sea view', 'Gym', 'Wi-Fi', '24h security'],
    description: 'Serviced apartments on the Msasani Peninsula near restaurants and the slipway.',
  },
  {
    id: 'dar-kariakoo-hotel', name: 'Kariakoo Business Hotel', type: 'hotel',
    region: 'Dar es Salaam', town: 'Kariakoo', scene: 'city', pricePerNight: 95000, units: 12, maxGuests: 2,
    amenities: ['Breakfast', 'Wi-Fi', 'Airport shuttle', 'Desk'],
    description: 'Practical rooms in the heart of the city’s busiest market district.',
  },
  {
    id: 'morogoro-highway-motel', name: 'Uluguru Highway Motel', type: 'motel',
    region: 'Morogoro', town: 'Morogoro', scene: 'mountain', pricePerNight: 55000, units: 10, maxGuests: 2,
    amenities: ['Drive-up parking', 'Restaurant', 'Wi-Fi', 'Hot shower'],
    description: 'Clean, affordable stop on the Dar–Dodoma road beneath the Uluguru Mountains.',
  },
  {
    id: 'dodoma-roadside-motel', name: 'Capital Roadside Motel', type: 'motel',
    region: 'Dodoma', town: 'Dodoma', scene: 'savanna', pricePerNight: 48000, units: 9, maxGuests: 2,
    amenities: ['Parking', 'Fan rooms', 'Snack bar', 'Wi-Fi'],
    description: 'Simple overnight rooms close to the city centre and the main bus terminal.',
  },
  {
    id: 'mwanza-lakeside-hotel', name: 'Rock City Lakeside Hotel', type: 'hotel',
    region: 'Mwanza', town: 'Mwanza', scene: 'lake', pricePerNight: 130000, units: 8, maxGuests: 3,
    amenities: ['Lake view', 'Pool', 'Breakfast', 'Conference room'],
    description: 'Overlooking Lake Victoria and the balancing granite boulders of Bismarck Rock.',
  },
  {
    id: 'kigoma-lake-lodge', name: 'Tanganyika Shore Lodge', type: 'lodge',
    region: 'Kigoma', town: 'Kigoma', scene: 'lake', pricePerNight: 160000, units: 5, maxGuests: 3,
    amenities: ['Private beach', 'Boat trips', 'Restaurant', 'Breakfast'],
    description: 'Lakeshore chalets and a jumping-off point for Gombe Stream.',
  },
  {
    id: 'mbeya-highlands-apartments', name: 'Southern Highlands Apartments', type: 'apartment',
    region: 'Mbeya', town: 'Mbeya', scene: 'mountain', pricePerNight: 80000, units: 4, maxGuests: 5,
    amenities: ['Fireplace', 'Kitchen', 'Parking', 'Wi-Fi'],
    description: 'Cosy, cool-climate apartments near tea estates and crater lakes.',
  },
];
