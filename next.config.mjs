/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // Cloudinary (existing)
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        port: '',
        pathname: '/**',
      },
      // Local dev
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '',
        pathname: '/**',
      },
      // Exact subdomain
      {
        protocol: 'https',
        hostname: 'min.lukpaluk.xyz',
        port: '',
        pathname: '/**',
      },
      // Apex domain
      {
        protocol: 'https',
        hostname: 'lukpaluk.xyz',
        port: '',
        pathname: '/**',
      },
      // Any subdomain of lukpaluk.xyz
      {
        protocol: 'https',
        hostname: '**.lukpaluk.xyz',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
