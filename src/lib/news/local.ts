import { getCache, setCache, deleteCache } from "@/lib/redis";
import fs from "fs";
import path from "path";

export interface LocalNewsArticle {
  title: string;
  source: string;
  date: string;
  url: string;
  description: string;
  image?: string;
  published_at: string;
}

const CACHE_KEY = "news:latest";
const CACHE_TTL = 43200; // 12 hours in seconds

export async function getLocalNews(): Promise<{ results: LocalNewsArticle[]; cached: boolean }> {
  try {
    // Try Redis cache first
    const cached = await getCache(CACHE_KEY);
    if (cached && Array.isArray(cached)) {
      return { results: cached as LocalNewsArticle[], cached: true };
    }

    // Load from seed file
    const filePath = path.join(process.cwd(), "data", "news", "seed.json");
    let data: LocalNewsArticle[] = [];

    try {
      const raw = fs.readFileSync(filePath, "utf8");
      data = JSON.parse(raw);
      
      // Validate data structure
      if (!Array.isArray(data)) {
        console.warn("Seed file does not contain an array, using empty array");
        data = [];
      }
    } catch (e) {
      console.error("No local news file found or invalid JSON:", e);
      // Return empty array if file doesn't exist
      data = [];
    }

    // Cache in Redis
    if (data.length > 0) {
      await setCache(CACHE_KEY, data, CACHE_TTL);
    }

    return { results: data, cached: false };
  } catch (error) {
    console.error("Error in getLocalNews:", error);
    return { results: [], cached: false };
  }
}

export async function refreshLocalNews(): Promise<{ results: LocalNewsArticle[]; cached: boolean }> {
  try {
    // Delete cache
    await deleteCache(CACHE_KEY);
    
    // Load fresh from seed file
    return await getLocalNews();
  } catch (error) {
    console.error("Error refreshing local news:", error);
    return { results: [], cached: false };
  }
}

export async function checkSeedFileExists(): Promise<boolean> {
  try {
    const filePath = path.join(process.cwd(), "data", "news", "seed.json");
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

