#!/bin/bash
# Script para configurar variables de entorno en Vercel
# Ejecutar DESPUÉS de hacer vercel deploy por primera vez

VERCEL=/Users/alexclavijo/.npm-global/node_modules/.bin/vercel

echo "Configurando variables de entorno en Vercel..."

# Production
echo "https://slasbfepqovdsezmadjh.supabase.co" | $VERCEL env add NEXT_PUBLIC_SUPABASE_URL production
echo "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsYXNiZmVwcW92ZHNlem1hZGpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MzYyMDMsImV4cCI6MjA5ODAxMjIwM30.1yfKc3juIYZp1BY5dX33d2D7iXvVbwwPCoGAL1r7uLE" | $VERCEL env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
echo "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsYXNiZmVwcW92ZHNlem1hZGpoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjQzNjIwMywiZXhwIjoyMDk4MDEyMjAzfQ.QSM6ZGFu7v3Q4zy7CBaCdzJxv11LwUYl83KXaVftb-Q" | $VERCEL env add SUPABASE_SERVICE_ROLE_KEY production
echo "https://actionusaai.com" | $VERCEL env add NEXT_PUBLIC_SITE_URL production

echo "✓ Variables configuradas para production"
