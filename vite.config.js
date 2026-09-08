import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        /*
          Split the two things that never change from the one that changes on
          every deploy. React and the Supabase client are ~140 KB of the bundle
          between them and are the same bytes deploy after deploy; left in the
          single file, every fix to a screen made the phone re-download all of
          it. Separated, and with the immutable cache headers in netlify.toml,
          a returning phone fetches only the app chunk.
        */
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
})
