import Footer from '@/components/common/Footer';
import HeroSection from '@/components/page/HeroSection';
import TopBar from '@/components/page/TopBar';
import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';

const WP_BASE = process.env.WP_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || '';

async function fetchPosts(perPage = 6) {
  if (!WP_BASE) return [];
  const url = `${WP_BASE.replace(/\/$/, '')}/wp-json/wp/v2/posts?per_page=${perPage}&_embed`;
  try {
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const data = await res.json();
    return data;
  } catch (err) {
    console.error('Failed to fetch posts', err);
    return [];
  }
}

function getFeaturedImage(post) {
  // _embedded may contain featured media
  try {
    const media = post._embedded?.['wp:featuredmedia']?.[0];
    if (media && media.source_url) return media.source_url;
  } catch (e) {}
  return '/images/about/labeling.jpg';
}

function decodeHtmlEntities(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}

export default async function BlogPage() {
  const posts = await fetchPosts(8);

  return (
    <>
      <Head>
        <title>LineFlow Blog</title>
        <meta name="description" content="Insights, guides and news from LineFlow" />
      </Head>

      <main>
        <TopBar />

        {/* Banner / Hero */}
        <HeroSection
          title={
            <>
              <span className="text-primary font-bold text-[64px] leading-[1.1] tracking-normal">
                Insights from
              </span>
              <span className="text-primary-500 font-normal text-[64px] leading-[1.1] tracking-normal">
                LineFlow
              </span>
            </>
          }
          // Provide any props your component expects (subtitle, bg, etc.)
          subtitle="Stay ahead with expert advice, industry trends, and innovative ways to streamline your workflow and showcase your brand."
        />

        {/* Posts grid */}
        <section className="container mx-auto px-4 py-12">
          {posts.length === 0 ? (
            <div className="text-center text-gray-500">No posts found.</div>
          ) : (
            <>
              {/* Featured first post */}
              {(() => {
                const p = posts[0];
                const slug = p.slug;
                const title = p.title?.rendered ?? '';
                const excerpt = p.excerpt?.rendered ?? '';
                const date = new Date(p.date).toLocaleDateString();
                const author = p._embedded?.author?.[0]?.name ?? '';
                const image = getFeaturedImage(p);
                const categoryRaw =
                  p._embedded?.['wp:term']?.[0]?.[0]?.name ??
                  p._embedded?.['wp:term']?.[0]?.[0]?.slug ??
                  '';
                const category = decodeHtmlEntities(categoryRaw);

                return (
                  <article className="relative overflow-hidden rounded-2xl bg-primary-100 p-6 border-slate-100">
                    <div className="grid grid-cols-1 lg:grid-cols-2">
                      {/* Left: text */}
                      <div className="p-4 sm:p-6 lg:p-6 flex flex-col justify-center">
                        {category ? (
                          <span className="self-start inline-block mb-4 rounded-full bg-white px-4 py-2 text-xs font-medium text-primary-500">
                            {category}
                          </span>
                        ) : null}

                        <h2 className="text-2xl md:text-3xl font-bold text-primary-500 mb-3">
                          <Link
                            href={`/blog/${slug}`}
                            className="hover:text-primary-500"
                            dangerouslySetInnerHTML={{ __html: title }}
                          />
                        </h2>

                        <p
                          className="text-gray-600 mb-6"
                          dangerouslySetInnerHTML={{ __html: excerpt }}
                        />

                        <div className="text-sm hidden text-slate-500 mb-6">
                          {date} {author ? <>&bull; {author}</> : null}
                        </div>

                        <div>
                          <Link
                            href={`/blog/${slug}`}
                            className="inline-flex items-center rounded-full px-5 py-3 text-sm font-semibold  text-primary-500 border-primary-500 border-2 hover:bg-primary-500 hover:text-white transition"
                          >
                            Read More
                          </Link>
                        </div>
                      </div>

                      {/* Right: image */}
                      <Link href={`/blog/${slug}`} className="relative h-64 sm:h-80 lg:h-full">
                        <Image
                          src={image}
                          alt={typeof title === 'string' ? title : 'Featured image'}
                          fill
                          className="object-cover"
                          priority
                        />
                      </Link>
                    </div>
                  </article>
                );
              })()}

              {/* Grid of remaining posts */}
              <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {posts.slice(1).map(post => {
                  const slug = post.slug;
                  const title = post.title?.rendered ?? '';
                  const excerpt = post.excerpt?.rendered ?? '';
                  const date = new Date(post.date).toLocaleDateString();
                  const author = post._embedded?.author?.[0]?.name ?? '';
                  const image = getFeaturedImage(post);
                  const categoryRaw =
                    post._embedded?.['wp:term']?.[0]?.[0]?.name ??
                    post._embedded?.['wp:term']?.[0]?.[0]?.slug ??
                    '';
                  const category = decodeHtmlEntities(categoryRaw);

                  return (
                    <article key={slug} className="bg-white overflow-hidden">
                      <Link href={`/blog/${slug}`} className="block group">
                        <div className="relative h-75 w-full rounded-2xl overflow-hidden">
                          <Image
                            src={image}
                            alt={title}
                            fill
                            className="object-cover transition-transform duration-500 group-hover:scale-105"
                          />

                          {/* Dark overlay */}
                          <div className="absolute inset-0 bg-black/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                          {/* Centered Read More pill */}
                          <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                            <span className="inline-flex items-center px-6 py-3 rounded-full text-sm text-white border border-white">
                              Read More
                            </span>
                          </div>
                        </div>
                      </Link>

                      <div className="py-4">
                        {category ? (
                          <span className="inline-block mb-3 rounded-full bg-primary-100 px-4 py-2 text-xs font-medium text-primary-500">
                            {category}
                          </span>
                        ) : null}

                        <h3 className="text-xl font-semibold text-black mb-2">
                          <Link
                            href={`/blog/${slug}`}
                            className="hover:text-primary-500"
                            dangerouslySetInnerHTML={{ __html: title }}
                          />
                        </h3>

                        <div
                          className="text-slate-600 mb-4 hidden"
                          dangerouslySetInnerHTML={{ __html: excerpt }}
                        />

                        <div className="text-sm text-slate-500 mb-4 hidden">
                          {date} {author ? <>&bull; {author}</> : null}
                        </div>

                        <Link
                          href={`/blog/${slug}`}
                          className="hidden items-center text-primary-500 font-medium "
                        >
                          Read More
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </section>

        <Footer />
      </main>
    </>
  );
}
