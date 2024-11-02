import pkg from "whatsapp-web.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import qrcode from "qrcode-terminal";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const { Client, LocalAuth, MessageMedia } = pkg;
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Inisialisasi klien untuk Google Generative AI
const genAI = new GoogleGenerativeAI(process.env.API_KEY);

// Inisialisasi klien WhatsApp menggunakan LocalAuth
const client = new Client({
  authStrategy: new LocalAuth(),
});

// Pastikan folder 'image' ada
const imageFolderPath = path.join(__dirname, "image");
if (!fs.existsSync(imageFolderPath)) {
  fs.mkdirSync(imageFolderPath);
}

// Fungsi untuk menangani pertanyaan teks
async function handleTextQuery(query) {
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });

  try {
    const result = await model.generateContentStream([query]);
    let responseText = "";
    for await (const chunk of result.stream) {
      responseText += chunk.text();
    }
    return responseText;
  } catch (error) {
    console.error("Error mengakses Google Generative AI:", error);
    return "Maaf, terjadi kesalahan saat mencoba mengakses AI.";
  }
}

// Fungsi untuk mengonversi file menjadi bagian yang dapat dibaca AI
function fileToGenerativePart(path, mimeType) {
  return {
    inlineData: {
      data: Buffer.from(fs.readFileSync(path)).toString("base64"),
      mimeType,
    },
  };
}

// Fungsi untuk menangani pertanyaan multimodal (teks dan gambar)
async function handleImageQuery(caption, imagePath) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

  const imagePart = fileToGenerativePart(imagePath, "image/png");

  try {
    const result = await model.generateContent([caption, imagePart]);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Error mengakses Google Generative AI:", error);
    return "Maaf, terjadi kesalahan saat mencoba mengakses AI dengan gambar.";
  }
}

// Event saat WhatsApp bot siap
client.on("ready", () => {
  console.log("Bot WhatsApp siap digunakan!");
});
client.on("qr", (qr) => {
  qrcode.generate(qr, { small: true });
  console.log("Scan QR code untuk login ke WhatsApp Web.");
});
// Event saat pesan diterima
client.on("message", async (msg) => {
  const { body, hasMedia, from } = msg;
  const userId = from;
  const userMessage = body;

  console.log(`Pesan diterima dari ${userId}: ${userMessage}`);

  // Jika pesan dimulai dengan ".tanya" (teks saja)
  if (body.startsWith(".ai ")) {
    if (hasMedia) {
      msg.reply("Menganalisis Gambar ⏳...");
      const caption = body.slice(8); // Hapus ".tanya2 " dari awal pesan

      try {
        const media = await msg.downloadMedia(); // Unduh media yang diterima
        if (media) {
          // Tentukan path gambar di dalam folder 'image' dengan nama asli
          const fileName = media.filename || "image_" + Date.now() + ".png"; // Gunakan filename asli atau beri nama unik jika tidak ada
          const imagePath = path.join(imageFolderPath, fileName);

          // Simpan gambar
          fs.writeFileSync(imagePath, media.data, "base64");

          const reply = await handleImageQuery(caption, imagePath);
          console.log("Balasan AI untuk gambar:", reply); // Log balasan AI untuk gambar
          await msg.reply(reply);
        } else {
          console.log("Gagal mengunduh gambar."); // Log error unduh gambar
          await msg.reply("Gagal mengunduh gambar. Silakan coba lagi.");
        }
      } catch (error) {
        console.error("Error mengunduh atau memproses gambar:", error);
        await msg.reply("Terjadi kesalahan saat memproses gambar.");
      }
    } else {
      msg.reply("Tunggu ⏳...");
      const query = body.slice(7); // Hapus ".tanya " dari awal pesan
      const reply = await handleTextQuery(query);
      console.log("Balasan AI:", reply); // Log balasan AI
      await msg.reply(reply);
    }
  } else if (body.startsWith("halo")) {
    msg.reply("Haiii");
  } else if (body.startsWith("hai")) {
    msg.reply("Halooo");
  } else if (body.startsWith(".menu")) {
    msg.reply(
      "======= Menu =======\n|\n|==> [ *_Adh._ AI Bot*]\n|\n|- .ai [image] [caption/question]\n|\n|- .ai [question]\n|\n____________________"
    );
  }
});

client.initialize();
