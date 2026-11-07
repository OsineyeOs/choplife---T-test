export interface DeliveryZoneMaster {
  id: string;
  branchId: 'gra' | 'okabere' | 'ugbowo';
  locationName: string;
  aliases: string[];
  deliveryFee: number;
  currency: 'NGN';
  status: 'APPROVED';
  estimatedMins: string;
}

// 1. GRA Master Delivery Schedule (56 Approved Locations - Source: Management Master Schedule)
export const GRA_DELIVERY_ZONES: DeliveryZoneMaster[] = [
  { id: 'gra-airport-rd', branchId: 'gra', locationName: 'Airport Road', aliases: ['Airport Rd', 'Ogba Airport'], deliveryFee: 2000, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'gra-etete', branchId: 'gra', locationName: 'Etete', aliases: ['Etete GRA'], deliveryFee: 2500, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'gra-limit', branchId: 'gra', locationName: 'Limit', aliases: ['Limit Road', 'Limit Sapele Rd'], deliveryFee: 2500, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'gra-country-home', branchId: 'gra', locationName: 'Country Home', aliases: ['Country Home Hotel', 'Country Home Road'], deliveryFee: 2500, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'gra-first-ugbor', branchId: 'gra', locationName: 'First Ugbor', aliases: ['1st Ugbor'], deliveryFee: 2000, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'gra-second-ugbor', branchId: 'gra', locationName: 'Second Ugbor', aliases: ['2nd Ugbor'], deliveryFee: 1700, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'gra-irhirhi', branchId: 'gra', locationName: 'Irhirhi', aliases: ['Irhirhi Road'], deliveryFee: 2500, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'gra-estate-gate', branchId: 'gra', locationName: 'Estate Gate', aliases: ['Federal Estate Gate'], deliveryFee: 2500, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'gra-okhoroumi', branchId: 'gra', locationName: 'Okhoroumi', aliases: ['Okhoromi'], deliveryFee: 3000, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'gra-arougba', branchId: 'gra', locationName: 'Arougba', aliases: ['Arougba Community'], deliveryFee: 3000, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'gra-amagba', branchId: 'gra', locationName: 'Amagba', aliases: ['Amagba Town'], deliveryFee: 3000, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'gra-ogunwenyi', branchId: 'gra', locationName: 'Ogunwenyi', aliases: ['Ogunmwenyi'], deliveryFee: 3000, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'gra-eke-open-uni', branchId: 'gra', locationName: 'Ekehuan Open University', aliases: ['Open University Ekehuan', 'NOUN Ekehuan'], deliveryFee: 3000, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'gra-plymouth', branchId: 'gra', locationName: 'Plymouth Road', aliases: ['Plymouth Rd'], deliveryFee: 2500, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'gra-agho', branchId: 'gra', locationName: 'Agho', aliases: ['Agho Street', 'Off Ekehuan'], deliveryFee: 3000, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'gra-ikpokpan', branchId: 'gra', locationName: 'Ikpokpan', aliases: ['Ikpokpan Road GRA'], deliveryFee: 2500, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'gra-faith-arena', branchId: 'gra', locationName: 'Faith Arena', aliases: ['Faith Arena CGMI'], deliveryFee: 1500, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'gra-ogba-river', branchId: 'gra', locationName: 'Ogba River', aliases: ['Ogba Zoo', 'Ogba Road'], deliveryFee: 3000, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'gra-obazagon', branchId: 'gra', locationName: 'Obazagon', aliases: ['Obazagbon'], deliveryFee: 3500, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'gra-high-court', branchId: 'gra', locationName: 'High Court', aliases: ['High Court Sapele Rd'], deliveryFee: 2500, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'gra-hallmark', branchId: 'gra', locationName: 'Hallmark Sapele Road', aliases: ['Hallmark', 'Sapele Rd Hallmark'], deliveryFee: 2500, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'gra-golf-course', branchId: 'gra', locationName: 'Golf Course', aliases: ['Benin Club Golf Course'], deliveryFee: 2000, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'gra-ring-road', branchId: 'gra', locationName: 'Ring Road', aliases: ['King Square', 'Ring Rd'], deliveryFee: 2500, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'gra-oko-central', branchId: 'gra', locationName: 'Oko Central', aliases: ['Oko Central Road'], deliveryFee: 2000, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'gra-gapiona', branchId: 'gra', locationName: 'Gapiona', aliases: ['Gapiona Street GRA'], deliveryFee: 1500, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'gra-ruben-agho', branchId: 'gra', locationName: 'Ruben Agho', aliases: ['Reuben Agho'], deliveryFee: 1500, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'gra-aikhionbare', branchId: 'gra', locationName: 'Aikhionbare', aliases: ['Akhionbare Street', 'Off Akhionbare'], deliveryFee: 1500, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'gra-ihama', branchId: 'gra', locationName: 'Ihama', aliases: ['Ihama Road GRA'], deliveryFee: 1700, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'gra-boundary-rd', branchId: 'gra', locationName: 'Boundary Road', aliases: ['Boundary Rd GRA'], deliveryFee: 2000, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'gra-aduwawa', branchId: 'gra', locationName: 'Aduwawa', aliases: ['Aduwawa Market'], deliveryFee: 4500, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'gra-upper-mission-ext', branchId: 'gra', locationName: 'Upper Mission Extension', aliases: ['Upper Mission Ext'], deliveryFee: 4500, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'gra-mission-rd', branchId: 'gra', locationName: 'Mission Road', aliases: ['Mission Rd'], deliveryFee: 3000, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'gra-new-benin', branchId: 'gra', locationName: 'New Benin', aliases: ['New Benin Market'], deliveryFee: 3000, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'gra-agbor-park', branchId: 'gra', locationName: 'Agbor Park', aliases: ['Agbor Motor Park', 'Ikpoba Agbor Park'], deliveryFee: 4500, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'gra-ikpoba-hill', branchId: 'gra', locationName: 'Ikpoba Hill', aliases: ['Ikpoba Slope', 'Ikpoba Hill Bridge'], deliveryFee: 4000, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'gra-biu-ugbor', branchId: 'gra', locationName: 'Biu Ugbor', aliases: ['Benson Idahosa Ugbor', 'BIU Ugbor Campus'], deliveryFee: 2000, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'gra-oybhioko', branchId: 'gra', locationName: 'Oybhioko', aliases: ['Obioko', 'Ovioko'], deliveryFee: 3500, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'gra-elema-palace', branchId: 'gra', locationName: 'Elema Palace', aliases: ['Chief Elema Palace'], deliveryFee: 1500, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'gra-vegetable-market', branchId: 'gra', locationName: 'Vegetable Market', aliases: ['Vegetable Market Airport Rd'], deliveryFee: 2000, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'gra-uholor', branchId: 'gra', locationName: 'Uholor', aliases: ['Uholor Community'], deliveryFee: 4000, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'gra-ulemon', branchId: 'gra', locationName: 'Ulemon', aliases: ['Ulemon Town'], deliveryFee: 3000, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'gra-uzebu', branchId: 'gra', locationName: 'Uzebu', aliases: ['Uzebu Quarters'], deliveryFee: 3500, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'gra-eke-barrack', branchId: 'gra', locationName: 'Ekehuan Barrack', aliases: ['Ekehuan Army Barracks'], deliveryFee: 4500, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'gra-siluko-rd', branchId: 'gra', locationName: 'Siluko Road', aliases: ['Siluko Rd'], deliveryFee: 3000, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'gra-egor-market', branchId: 'gra', locationName: 'Egor Market', aliases: ['Egor Local Govt'], deliveryFee: 3500, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'gra-ezoti', branchId: 'gra', locationName: 'Ezoti', aliases: ['Ezoti Street'], deliveryFee: 2000, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'gra-benoni', branchId: 'gra', locationName: 'Benoni', aliases: ['Benoni Hospital Road', 'Benoni GRA'], deliveryFee: 1700, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'gra-adesuwa', branchId: 'gra', locationName: 'Adesuwa', aliases: ['Adesuwa Road', 'Adesuwa Grammar School'], deliveryFee: 2000, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'gra-adp', branchId: 'gra', locationName: 'ADP', aliases: ['ADP Junction', 'ADP Office'], deliveryFee: 2000, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'gra-first', branchId: 'gra', locationName: 'First', aliases: ['1st East Circular', 'First Circular'], deliveryFee: 3000, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'gra-second', branchId: 'gra', locationName: 'Second', aliases: ['2nd East Circular', 'Second Circular'], deliveryFee: 3000, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'gra-bob-izua', branchId: 'gra', locationName: 'Bob Izua', aliases: ['Bob Izua Motors', 'Bob Izua Park'], deliveryFee: 2500, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'gra-dawson', branchId: 'gra', locationName: 'Dawson', aliases: ['Dawson Road'], deliveryFee: 3000, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'gra-mtn-mast', branchId: 'gra', locationName: 'MTN Mast', aliases: ['MTN Mast Ugbor / Etete'], deliveryFee: 2500, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'gra-egba', branchId: 'gra', locationName: 'Egba', aliases: ['Egba Junction'], deliveryFee: 4500, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'gra-ramat', branchId: 'gra', locationName: 'Ramat', aliases: ['Ramat Park'], deliveryFee: 4000, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
];

// 2. Okabere (Sapele Road) Master Delivery Schedule (34 Approved Locations - Source: Authoritative Handwritten Branch Delivery Sheet)
export const OKABERE_DELIVERY_ZONES: DeliveryZoneMaster[] = [
  { id: 'oka-okabere', branchId: 'okabere', locationName: 'Okabere', aliases: ['Okabere Community', 'Okabere Junction'], deliveryFee: 1700, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'oka-pz', branchId: 'okabere', locationName: 'PZ', aliases: ['PZ Junction', 'PZ Sapele Rd'], deliveryFee: 2000, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'oka-eriara', branchId: 'okabere', locationName: 'Eriara', aliases: ['Eriaria'], deliveryFee: 2000, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'oka-erhaguan', branchId: 'okabere', locationName: 'Erhaguan', aliases: ['Ewaebogun', 'Ewabogun'], deliveryFee: 2500, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'oka-winners', branchId: 'okabere', locationName: 'Winners', aliases: ['Winners Chapel Sapele Rd'], deliveryFee: 2000, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'oka-ekae', branchId: 'okabere', locationName: 'Ekae', aliases: ['Ekae Community'], deliveryFee: 2500, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'oka-country-home', branchId: 'okabere', locationName: 'Country Home', aliases: ['Country Home Road Sapele Rd'], deliveryFee: 2000, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'oka-falenu', branchId: 'okabere', locationName: 'Falenu', aliases: ['Falsnu'], deliveryFee: 2500, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'oka-ugbor-village', branchId: 'okabere', locationName: 'Ugbor Village', aliases: ['Ugbor Village Road'], deliveryFee: 2500, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'oka-ogunwenyi', branchId: 'okabere', locationName: 'Ogunwenyi', aliases: ['Ogunmwenyi'], deliveryFee: 2500, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'oka-amagba', branchId: 'okabere', locationName: 'Amagba', aliases: ['Amagba Sapele Axis'], deliveryFee: 3000, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'oka-peanut-junc', branchId: 'okabere', locationName: 'Peanut Junction', aliases: ['Peanut Junc'], deliveryFee: 3000, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'oka-inside-peanut', branchId: 'okabere', locationName: 'Inside Peanut', aliases: ['Inside Peanut Road'], deliveryFee: 3500, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'oka-sunny-rd', branchId: 'okabere', locationName: 'Sunny Road', aliases: ['Sunray Rd', 'Sunray Road'], deliveryFee: 3500, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'oka-obe', branchId: 'okabere', locationName: 'Obe', aliases: ['Obe Community'], deliveryFee: 3500, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'oka-cream-2go', branchId: 'okabere', locationName: 'Cream 2go', aliases: ['Cream 2 Go'], deliveryFee: 3500, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'oka-ogheghe', branchId: 'okabere', locationName: 'Ogheghe', aliases: ['Ogheghe Community', 'Ogheghe Junction'], deliveryFee: 4000, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'oka-sapele-express', branchId: 'okabere', locationName: 'Sapele Express', aliases: ['Sapele Bypass', 'Sapele By-pass'], deliveryFee: 4000, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'oka-biu-oka', branchId: 'okabere', locationName: 'Biu Oka', aliases: ['Biu Okha', 'BIU Sapele Rd'], deliveryFee: 4000, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'oka-etinosa', branchId: 'okabere', locationName: 'Etinosa', aliases: ['Etmosa', 'Etinosa Community'], deliveryFee: 4500, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'oka-tomline-farm', branchId: 'okabere', locationName: 'Tomline Farm', aliases: ['Tomatoes Farm', 'Tomline'], deliveryFee: 5000, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'oka-balm-gilead', branchId: 'okabere', locationName: 'Balm of Gilead', aliases: ['Balm of Gilead Church / Camp'], deliveryFee: 6000, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'oka-uroho-3', branchId: 'okabere', locationName: 'Uroho 3', aliases: ['Uroho 3 Community'], deliveryFee: 5000, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'oka-st-saviour', branchId: 'okabere', locationName: 'St. Saviour', aliases: ['St Saviour Road', 'St. Saviours'], deliveryFee: 3500, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'oka-oka-market', branchId: 'okabere', locationName: 'Oka Market', aliases: ['Oka Market Sakponba'], deliveryFee: 3500, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'oka-upper-sakponba', branchId: 'okabere', locationName: 'Upper Sakponba', aliases: ['Upper Sokponba'], deliveryFee: 3500, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'oka-3-house', branchId: 'okabere', locationName: '3 House', aliases: ['Three House', '3-House Upper Sakponba'], deliveryFee: 3500, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'oka-egba', branchId: 'okabere', locationName: 'Egba', aliases: ['Egba Community Sapele'], deliveryFee: 4000, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'oka-idogbo', branchId: 'okabere', locationName: 'Idogbo', aliases: ['Idogbo Secretariat'], deliveryFee: 4500, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'oka-mm-way', branchId: 'okabere', locationName: 'MM Way', aliases: ['Murtala Mohammed Way', 'MM Way Sapele End'], deliveryFee: 3000, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'oka-3rd-circular', branchId: 'okabere', locationName: '3rd Circular', aliases: ['Third Circular'], deliveryFee: 3000, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'oka-ogiso', branchId: 'okabere', locationName: 'Ogiso', aliases: ['Ogiso Street'], deliveryFee: 3000, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'oka-erediauwa', branchId: 'okabere', locationName: 'Erediauwa', aliases: ['Erediauwa Street'], deliveryFee: 3000, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'oka-limit', branchId: 'okabere', locationName: 'Limit', aliases: ['Limit Sapele Road End'], deliveryFee: 2500, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
];

// 3. Ugbowo Master Delivery Schedule (32 Approved Locations - Source: Authoritative Handwritten Branch Delivery Sheet)
export const UGBOWO_DELIVERY_ZONES: DeliveryZoneMaster[] = [
  { id: 'ugb-st-barracks', branchId: 'ugbowo', locationName: 'S&T Barracks', aliases: ['SKT Barracks', 'S&T Barracks Isihor'], deliveryFee: 1700, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'ugb-ekosodin', branchId: 'ugbowo', locationName: 'Ekosodin', aliases: ['Ekosodin Village', 'Ekosodin UNIBEN'], deliveryFee: 2000, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'ugb-isihor', branchId: 'ugbowo', locationName: 'Isihor', aliases: ['Isihor Community'], deliveryFee: 1700, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'ugb-agen', branchId: 'ugbowo', locationName: 'Agen', aliases: ['Agen Community'], deliveryFee: 2000, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'ugb-main-gate', branchId: 'ugbowo', locationName: 'Main Gate', aliases: ['UNIBEN Main Gate', 'Main Gate Ugbowo'], deliveryFee: 2000, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'ugb-evidence', branchId: 'ugbowo', locationName: 'Evidence', aliases: ['Evivdencia', 'Evidence Junction'], deliveryFee: 2500, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'ugb-bms', branchId: 'ugbowo', locationName: 'BMS', aliases: ['BMS Quarters', 'Basic Medical Science'], deliveryFee: 2500, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'ugb-ubth', branchId: 'ugbowo', locationName: 'UBTH', aliases: ['Ubth', 'Ubin', 'University of Benin Teaching Hospital'], deliveryFee: 2500, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'ugb-doctor-house', branchId: 'ugbowo', locationName: 'Doctor House', aliases: ['Doctors House', 'Doctors Quarters UBTH'], deliveryFee: 2500, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'ugb-19th-street', branchId: 'ugbowo', locationName: '19th Street', aliases: ['19th Street BDPA'], deliveryFee: 2000, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'ugb-bdpa', branchId: 'ugbowo', locationName: 'BDPA', aliases: ['BDPA Estate', 'Bdpa'], deliveryFee: 2000, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'ugb-adolor', branchId: 'ugbowo', locationName: 'Adolor', aliases: ['Adolor College', 'Adolor Junction'], deliveryFee: 2500, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'ugb-fggc', branchId: 'ugbowo', locationName: 'FGGC', aliases: ['Eggc', 'Fgge', 'Federal Girls Ugbowo'], deliveryFee: 2500, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'ugb-uselu', branchId: 'ugbowo', locationName: 'Uselu', aliases: ['Uselu Market', 'Usehlu'], deliveryFee: 3000, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'ugb-textile-mill', branchId: 'ugbowo', locationName: 'Textile Mill', aliases: ['Textile Mill Road', 'Asoro Textile Mill'], deliveryFee: 3000, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'ugb-okhun', branchId: 'ugbowo', locationName: 'Okhun', aliases: ['OKhun Community'], deliveryFee: 2500, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'ugb-oluku', branchId: 'ugbowo', locationName: 'Oluku', aliases: ['Oluku Junction', 'Oluku Toll Gate'], deliveryFee: 3000, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'ugb-obiogie', branchId: 'ugbowo', locationName: 'Obiogie', aliases: ['Abiogie', 'Obazagie'], deliveryFee: 3500, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'ugb-tipper-garage', branchId: 'ugbowo', locationName: 'Tipper Garage', aliases: ['Tipper Garage Ugbowo'], deliveryFee: 2500, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'ugb-7up', branchId: 'ugbowo', locationName: '7 Up', aliases: ['7up Bottling Plant Ugbowo'], deliveryFee: 2500, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'ugb-uwelu', branchId: 'ugbowo', locationName: 'Uwelu', aliases: ['Uwelu Spare Parts Market'], deliveryFee: 3500, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'ugb-inside-okhun', branchId: 'ugbowo', locationName: 'Inside Okhun', aliases: ['Inside OKhun'], deliveryFee: 3000, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'ugb-film-house', branchId: 'ugbowo', locationName: 'Film House', aliases: ['Film House Ugbowo'], deliveryFee: 2000, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'ugb-uwasota', branchId: 'ugbowo', locationName: 'Uwasota', aliases: ['Uwasota Road'], deliveryFee: 2500, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'ugb-technical-rd', branchId: 'ugbowo', locationName: 'Technical Road', aliases: ['Technical Rd'], deliveryFee: 2500, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'ugb-uselu-shell', branchId: 'ugbowo', locationName: 'Uselu Shell', aliases: ['Usehlu Shell', 'Shell Uselu'], deliveryFee: 3000, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'ugb-five-junction', branchId: 'ugbowo', locationName: 'Five Junction', aliases: ['5 Junction Uselu'], deliveryFee: 3000, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'ugb-medical-store', branchId: 'ugbowo', locationName: 'Medical Store', aliases: ['Medical Stores Road'], deliveryFee: 3500, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'ugb-okhoro', branchId: 'ugbowo', locationName: 'Okhoro', aliases: ['Okhuoro', 'Okhoro Road'], deliveryFee: 3500, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'ugb-megam', branchId: 'ugbowo', locationName: 'Megam', aliases: ['Megam Station'], deliveryFee: 2000, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'ugb-st-patrick', branchId: 'ugbowo', locationName: 'St. Patrick', aliases: ['St. Patrick School / Church'], deliveryFee: 2500, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
  { id: 'ugb-terminal-oluku', branchId: 'ugbowo', locationName: 'Terminal Oluku', aliases: ['Oluku Park Terminal'], deliveryFee: 3500, currency: 'NGN', status: 'APPROVED', estimatedMins: '30–90 mins' },
];

export const ALL_DELIVERY_ZONES: Record<'gra' | 'okabere' | 'ugbowo', DeliveryZoneMaster[]> = {
  gra: GRA_DELIVERY_ZONES,
  okabere: OKABERE_DELIVERY_ZONES,
  ugbowo: UGBOWO_DELIVERY_ZONES,
};

export const getDeliveryFeeForBranchAndArea = (branchId: 'gra' | 'okabere' | 'ugbowo', areaName: string): number | null => {
  const branchZones = ALL_DELIVERY_ZONES[branchId];
  if (!branchZones) return null;
  const match = branchZones.find(
    (z) => z.locationName.toLowerCase() === areaName.toLowerCase() ||
           z.aliases.some((a) => a.toLowerCase() === areaName.toLowerCase())
  );
  return match ? match.deliveryFee : null;
};
