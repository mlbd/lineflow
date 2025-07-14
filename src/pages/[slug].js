import { useState, useEffect } from "react"
import CustomLoading from "@/components/CustomLoading"
import CircleReveal from "@/components/CircleReveal"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export async function getStaticPaths() {
  return { paths: [], fallback: "blocking" }
}

export async function getStaticProps({ params }) {
  return { props: { slug: params.slug }, revalidate: 60 }
}

export default function LandingPage({ slug }) {
  const [title, setTitle] = useState(null)
  const [dataLoaded, setDataLoaded] = useState(false)
  const [animationDone, setAnimationDone] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_WP_SITE_URL}/wp-json/wp/v2/pages?slug=${slug}`)
        if (!res.ok) throw new Error()
        const data = await res.json()
        if (!data?.length) throw new Error()
        setTitle(data[0].title.rendered)
      } catch {
        setError(true)
      } finally {
        setDataLoaded(true)
      }
    }
    fetchData()
  }, [slug])

  // 1. Show loading while fetching
  if (!dataLoaded) return <CustomLoading />

  // 2. Show circle reveal after data load, until animation is done
  if (!animationDone) return <CircleReveal onFinish={() => setAnimationDone(true)} />

  // 3. After both loading + animation are done, show page
  if (error)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-600 text-xl">Page not found or failed to load.</p>
      </div>
    )

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex flex-col items-center justify-center px-4 py-12">
      <Card className="max-w-xl w-full shadow-2xl border border-gray-200 rounded-2xl p-6 text-center">
        <CardContent>
          <h1 className="text-4xl font-bold mb-4 text-gray-900">{title}</h1>
          <p className="text-gray-600 text-lg mb-6">
            This is a demo landing page powered by WordPress and Next.js using ShadCN UI.
          </p>
          <Button className="text-white bg-black hover:bg-gray-900 px-6 py-2">Get Started</Button>
        </CardContent>
      </Card>
    </div>
  )
}
