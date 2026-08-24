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
        background: '#070B14',
        surface: {
          DEFAULT: '#0D1526',
          muted: '#131E35',
          border: '#1F2E4D',
          hover: '#192845',
        },
        razorpay: {
          DEFAULT: '#3395FF',
          dark: '#0C2340',
          light: '#528FF0',
          glow: 'rgba(51, 149, 255, 0.15)',
        },
        financial: {
          profit: '#10B981',
          risk: '#F59E0B',
          loss: '#EF4444',
          neutral: '#94A3B8',
          purple: '#8B5CF6',
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
