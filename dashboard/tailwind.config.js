/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#F8FAFC',
        surface: {
          DEFAULT: '#FFFFFF',
          muted: '#F1F5F9',
          border: '#E2E8F0',
          hover: '#F8FAFC',
        },
        razorpay: {
          DEFAULT: '#0066FF',
          dark: '#0C2340',
          light: '#2563EB',
          navy: '#0C2340',
        },
        financial: {
          profit: '#059669',
          risk: '#D97706',
          loss: '#DC2626',
          neutral: '#64748B',
          purple: '#7C3AED',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
