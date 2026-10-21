import dns from "node:dns";
import mongoose from "mongoose";
import { getConfig } from "./env.js";

// Some networks block SRV lookups; optionally force public DNS.
if (process.env.DNS_SERVERS) {
  dns.setServers(process.env.DNS_SERVERS.split(",").map((s) => s.trim()));
}

export async function connectDb() {
  const { mongoUri } = getConfig();
  if (!mongoUri)
    throw new Error(
      "MONGODB_URI is not set. Copy .env.example to .env and add your connection string.",
    );
  mongoose.set("strictQuery", true);
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 15000 });
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
  console.log("MongoDB connected");
}
