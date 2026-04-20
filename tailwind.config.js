/** @type {import('tailwindcss').Config} */
export default {
    content: [
        './*.html',
        './westside/**/*.html',
        './aviation/**/*.html',
        './burbuja/**/*.html',
        './assets/**/*.js',
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
                heading: ['Anton', 'Impact', 'sans-serif-condensed', 'sans-serif'],
            },
        },
    },
    plugins: [
        require('@tailwindcss/forms'),
    ],
}
