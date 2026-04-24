import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_SUPABASE_URL: "https://vpafgqdgkjuztkfajtff.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwYWZncWRna2p1enRrZmFqdGZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMDI1MTAsImV4cCI6MjA5MjU3ODUxMH0.RhjqLqqwGjVxiADieIZchmahyiEVrjJVrqSIPiFGkQQ"
  }
};

export default nextConfig;
