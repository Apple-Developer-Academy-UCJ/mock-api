import type { DatabaseSync } from 'node:sqlite';
import { populateAvatars } from './avatars.js';

export const timestamp = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

export function seed(db: DatabaseSync) {
  const now = timestamp();
  const users = [
    ['Budi Santoso', 'budi.santoso@example.com'], ['Siti Rahayu', 'siti.rahayu@example.com'],
    ['Dewi Lestari', 'dewi.lestari@example.com'], ['Rizky Pratama', 'rizky.pratama@example.com'],
    ['Putri Wulandari', 'putri.wulandari@example.com'], ['Agus Setiawan', 'agus.setiawan@example.com']
  ];
  const insertUser = db.prepare('INSERT INTO users (full_name,email,avatar_url,created_at) VALUES (?,?,NULL,?)');
  users.forEach(([name, email]) => insertUser.run(name, email, now));
  const shops = [
    [1, 'Toko Batik Nusantara', 'Batik pilihan untuk keseharian dan acara istimewa.', 'Surakarta', 'gold'],
    [2, 'Kopi Senja Bandung', 'Kopi dari petani Indonesia, disangrai dengan sepenuh hati.', 'Bandung', 'silver'],
    [3, 'Kerajinan Jogja', 'Kerajinan tangan karya perajin lokal Yogyakarta.', 'Yogyakarta', 'bronze']
  ];
  const insertShop = db.prepare('INSERT INTO shops (ownerId,shopName,description,city,shopTier,createdAt) VALUES (?,?,?,?,?,?)');
  shops.forEach(row => insertShop.run(...row, now));
  const products: [number, string, string | null, number, number][] = [
    [1, 'Kemeja Batik Parang', 'Kemeja katun bermotif parang, nyaman dipakai seharian.', 185000, 12],
    [1, 'Blus Batik Kawung', 'Blus batik dengan motif kawung klasik.', 165000, 8],
    [1, 'Kain Batik Mega Mendung', 'Kain batik bermotif mega mendung berwarna biru.', 250000, 5],
    [1, 'Selendang Batik Sekar Jagad', null, 95000, 0],
    [1, 'Kemeja Batik Truntum', 'Kemeja batik untuk acara keluarga.', 210000, 7],
    [2, 'Kopi Arabika Gayo', 'Biji kopi arabika Gayo sangrai sedang, kemasan 250 gram.', 85000, 20],
    [2, 'Kopi Robusta Temanggung', 'Kopi robusta dengan cita rasa pekat, kemasan 250 gram.', 55000, 18],
    [2, 'Kopi Arabika Toraja', 'Biji kopi pilihan dari dataran tinggi Toraja.', 90000, 10],
    [2, 'Kopi Susu Gula Aren', 'Kopi susu dengan gula aren, botol 250 ml.', 22000, 0],
    [2, 'Paket Seduh Kopi Tubruk', null, 45000, 15],
    [3, 'Tas Anyaman Rotan', 'Tas rotan buatan tangan dengan lapisan kain.', 175000, 9],
    [3, 'Keranjang Bambu', 'Keranjang serbaguna dari bambu pilihan.', 65000, 14],
    [3, 'Dompet Tenun Lurik', 'Dompet kecil berbahan tenun lurik.', 45000, 25],
    [3, 'Hiasan Dinding Makrame', 'Hiasan dinding dari tali katun alami.', 120000, 6],
    [3, 'Tempat Tisu Kayu Jati', 'Tempat tisu dengan tekstur kayu alami.', 80000, 11]
  ];
  const insertProduct = db.prepare('INSERT INTO products (shopId,productName,description,price,stockCount,imageUrl,isAvailable,createdAt) VALUES (?,?,?,?,?,NULL,?,?)');
  products.forEach(([shop, name, description, price, stock]) => insertProduct.run(shop, name, description, price, stock, Number(stock > 0), now));
  const comments = ['Kualitasnya bagus dan sesuai deskripsi.', 'Pengiriman cepat, kemasan rapi.', 'Produk nyaman digunakan, terima kasih.', 'Cukup baik, tetapi kemasan perlu diperbaiki.', 'Sangat puas, akan pesan lagi.', 'Barang sesuai foto dan harga terjangkau.'];
  const insertReview = db.prepare('INSERT INTO reviews (product_id,user_id,rating,review_text,created_at) VALUES (?,?,?,?,?)');
  // Product 1 has ratings 5 + 4 + 4 = 13; products 13–15 have no reviews.
  const productIds = [1, 1, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 2, 3, 6, 7, 8, 11];
  const ratings = [5, 4, 4, 3, 5, 2, 4, 5, 3, 4, 1, 5, 4, 3, 4, 5, 5, 4, 2, 5];
  productIds.forEach((product, i) => insertReview.run(product, i % 6 + 1, ratings[i], comments[i % comments.length], now));
  populateAvatars(db);
}
