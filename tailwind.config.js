/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        poppinsFont: ["Poppins", "sans-serif"],
      },
      colors: {
        primaryGreen: "#0057A2",
        primary200: "#99CBAB",
        primary600: "#005093",
        primary700: "#00581F",
        primary800: "#004166",
        primary900: "#001909",
        primaryYellow: "#D5FF00",
        green50: "#FAFEF5",
        green100: "#CCE5FB",
        gray50: "#F9FAFB",
        gray100: "#F2F4F7",
        gray200: "#EAECF0",
        gray300: "#D0D5DD",
        gray400: "#98A2B3",
        gray500: "#667085",
        gray600: "#475467",
        gray700: "#344054",
        gray800: "#1D2939",
        gray900: "#101828",
        warning: "#DC6803",
        errorColor:"#D92D20"
      },
    },
  },
  plugins: [],
};
