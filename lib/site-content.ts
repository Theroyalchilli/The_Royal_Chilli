// Real copy for the public website, migrated from The-Royal-Chilli/content.json.
// Not DB-backed yet — becomes admin-editable once the Admin Dashboard module is built.

export const siteContent = {
  hero: {
    tag: "Authentic Indian Cuisine · London",
    line1: "From the Heart",
    line2: "Royal in Taste, Rich in Tradition",
    desc: "Experience the rich flavours and time-honoured traditions of authentic Indian cooking — every dish crafted with love, care, and passion in the heart of London.",
    bgImages: [
      "/hero/interior-1.jpg",
      "/hero/interior-2.jpg",
      "/hero/interior-3.jpg",
    ],
    // Separate portrait set for mobile — the desktop photos above are
    // landscape and crop badly full-bleed on a tall phone viewport.
    // Storefront goes first so the very first thing mobile visitors see
    // is the shopfront, not an interior detail shot.
    mobileBgImages: [
      "/hero/mobile-storefront.jpg",
      "/hero/mobile-table.jpg",
      "/hero/mobile-bar.jpg",
    ],
  },
  about: {
    title: "Where Every Dish Tells a Story of",
    titleGold: "Passion & Heritage",
    text1:
      "The Royal Chilli was born from a deep love for authentic Indian flavours and the age-old traditions of Indian cooking. We bring you the very best of South and North Indian cuisine, using the freshest ingredients and spices imported directly from India.",
    text2:
      "Our chefs, trained in the finest culinary traditions, create dishes that transport you straight to the bustling streets and royal kitchens of India — right here in London.",
  },
  contact: {
    phone: "020 8797 3044",
    waNumber: "442087973044",
    address: "43 Kingsley Road, Hounslow, London, TW3 1PA",
    mapEmbed:
      "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2485.593!2d-0.3580133!3d51.4722309!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x48760d00575f94db%3A0x374941cb29fce285!2sThe%20Royal%20Chilli!5e0!3m2!1sen!2suk!4v1718000000000!5m2!1sen!2suk",
    hours: [
      { day: "Mon – Thu", time: "9:00 AM – 11:00 PM" },
      { day: "Friday", time: "11:00 AM – 11:00 PM" },
      { day: "Saturday", time: "9:00 AM – 11:00 PM" },
      { day: "Sunday", time: "9:00 AM – 11:00 PM" },
    ],
    social: {
      instagram: "https://www.instagram.com/the_royal_chilli?igsh=MW12MTVzY2p0ZmUycw==",
    },
  },
  testimonials: [
    { name: "Aditya Sharma", platform: "Google Review", stars: 5, text: "Absolutely incredible food! The Chicken 65 and Biryani are out of this world. You can taste the authenticity in every bite. Best Indian restaurant in London by far!" },
    { name: "Priya Patel", platform: "Google Review", stars: 5, text: "The Royal Dum Biryani is a masterpiece. Warm and attentive service, beautiful ambiance, and food that tasted just like home in Hyderabad. Will be back every week!" },
    { name: "Mohammed Ali", platform: "Google Review", stars: 5, text: "Been coming here for months and it never disappoints. The Butter Chicken and Garlic Naan are simply divine. Staff are always friendly and welcoming — love this place!" },
    { name: "Sarah Johnson", platform: "Google Review", stars: 5, text: "Tried the Chilli Paneer and the Mixed Grill Platter — both phenomenal! The Royal Chilli truly lives up to its name. Highly recommend exploring the Specials menu." },
    { name: "Ravi Kumar", platform: "Google Review", stars: 5, text: "The flavours are genuine and authentic. Spice levels are perfectly balanced. This has become our family's go-to restaurant for every celebration. Absolutely love it!" },
  ],
  reservation: {
    tag: "Reserve a Table",
    title: "Reserve Your",
    titleGold: "Table",
    desc: "Whether it's a date night, family gathering or special celebration — we're here to make it truly memorable.",
  },
  footer: {
    tagline: "Bringing the rich flavours and warmth of authentic Indian cuisine to the heart of London.",
    copyright: "© 2026 The Royal Chilli. All rights reserved.",
  },
  galleryImages: [
    "Royal_Mixed_Platter", "Chicken_Dum_Biryani", "Lamb_Dum_Biryani", "Tandoori_Sizzler",
    "Chicken_Lollipop", "Paneer", "Masala_Dosa", "Haleem",
  ].map(name => `/gallery/${name}.webp`),
};
