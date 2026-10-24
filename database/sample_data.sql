-- ZELVORA sample vehicles (3 categories). Safe to run more than once.
-- No users or passwords are created here. Use backend/create_admin.py for the admin.

USE zelvora_db;

INSERT IGNORE INTO vehicles
  (name, brand, model, category, registration_number, fuel_type, transmission, seats, price_per_day, image_url, description, status)
VALUES
('Swift Zxi', 'Maruti Suzuki', 'Swift 2023', 'Car', 'WB 02 AB 1001', 'Petrol', 'Manual', 5, 1800.00, '/images/car-hatchback.svg',
 'A light, easy-to-park hatchback that is perfect for city errands and weekend drives. Good mileage and a very forgiving clutch.', 'Active'),
('Creta SX', 'Hyundai', 'Creta 2023', 'Car', 'WB 02 CD 2002', 'Diesel', 'Automatic', 5, 3200.00, '/images/car-suv.svg',
 'A comfortable compact SUV with a smooth automatic gearbox, rear AC vents and plenty of boot space for family trips.', 'Active'),
('Nexon EV Max', 'Tata', 'Nexon EV 2024', 'Car', 'WB 06 EF 3003', 'Electric', 'Automatic', 5, 3600.00, '/images/car-suv.svg',
 'A quiet electric SUV with strong acceleration and a long range. Pick it up fully charged. Ideal for relaxed city travel.', 'Active'),
('City ZX', 'Honda', 'City 2022', 'Car', 'WB 74 GH 4004', 'Petrol', 'Automatic', 5, 2800.00, '/images/car-sedan.svg',
 'A refined sedan with a spacious back seat and a calm ride. A dependable choice for business travel and long highways.', 'Active'),
('Thar LX', 'Mahindra', 'Thar 2023', 'Car', 'WB 02 JK 5005', 'Diesel', 'Manual', 4, 4200.00, '/images/car-suv.svg',
 'A rugged four-seat SUV with a commanding view of the road. Built for hill roads and weekend getaways.', 'Active'),
('Classic 350', 'Royal Enfield', 'Classic 350 2023', 'Bike', 'WB 02 LM 6006', 'Petrol', 'Manual', 2, 1100.00, '/images/bike-cruiser.svg',
 'The relaxed thumping cruiser with a comfortable seat. A favourite for long, unhurried rides.', 'Active'),
('Pulsar NS200', 'Bajaj', 'NS200 2022', 'Bike', 'WB 02 NP 7007', 'Petrol', 'Manual', 2, 900.00, '/images/bike-sport.svg',
 'A sharp, sporty naked bike with confident handling. A fun choice for quick city rides.', 'Active'),
('Duke 200', 'KTM', 'Duke 200 2023', 'Bike', 'WB 06 QR 8008', 'Petrol', 'Manual', 2, 1200.00, '/images/bike-sport.svg',
 'A light and punchy bike with a sporty stance. Quick off the line and easy to flick through traffic.', 'Active'),
('R15 V4', 'Yamaha', 'R15 V4 2023', 'Bike', 'WB 74 ST 9009', 'Petrol', 'Manual', 2, 1300.00, '/images/bike-sport.svg',
 'A full-fairing sports bike with a racing-inspired design and a smooth, high-revving engine.', 'Active'),
('Activa 6G', 'Honda', 'Activa 6G 2023', 'Scooter', 'WB 02 UV 1010', 'Petrol', 'Automatic', 2, 500.00, '/images/scooter-classic.svg',
 'The easy everyday scooter. Smooth, reliable and very simple to ride. Great for short trips around town.', 'Active'),
('Jupiter 125', 'TVS', 'Jupiter 125 2023', 'Scooter', 'WB 02 WX 1111', 'Petrol', 'Automatic', 2, 550.00, '/images/scooter-classic.svg',
 'A comfortable scooter with a roomy seat and good under-seat storage for shopping and daily commuting.', 'Active'),
('450X Gen 3', 'Ather', '450X 2024', 'Scooter', 'WB 06 YZ 1212', 'Electric', 'Automatic', 2, 800.00, '/images/scooter-electric.svg',
 'A zippy electric scooter with a bright touchscreen dashboard. Quiet, quick and cheap to run.', 'Active');
