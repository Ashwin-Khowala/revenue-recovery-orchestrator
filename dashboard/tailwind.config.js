/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/lib/**/*.{js,ts,jsx,tsx,mdx}',
    './src/types/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#FAFAFA',
        // "Salt and Pepper" Design System Palette
        salt: {
          50: '#FAFAFA',
          100: '#F5F5F5',
          200: '#EBEBEB',
          300: '#D4D4D4', // Primary Salt Light Border / Surface
          400: '#B3B3B3', // Salt Mid / Secondary Muted Text
          500: '#8C8C8C',
        },
        pepper: {
          DEFAULT: '#2B2B2B', // Primary Pepper Charcoal
          dark: '#1F1F1F',
          light: '#3D3D3D',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          muted: '#FAFAFA',
          border: '#D4D4D4',
          hover: '#F5F5F5',
        },
        razorpay: {
          DEFAULT: '#0066FF',
          dark: '#0C2340',
          light: '#2563EB',
          navy: '#0C2340',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
