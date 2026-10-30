import config from "@payload-config"
import { connection } from "next/server"
import { getPayload } from "payload"
import NewMusiqApp, { type ListenerComment } from "./NewMusiqApp"

export default async function HomePage() {
  await connection()
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: "listener-comments",
    depth: 0,
    limit: 20,
    overrideAccess: false,
    sort: "-createdAt",
    where: {
      trackKey: {
        equals: "golden-moon",
      },
    },
  })

  const comments: ListenerComment[] = result.docs.map((comment) => ({
    id: String(comment.id),
    displayName: comment.displayName,
    message: comment.message,
    createdAt: comment.createdAt,
    pending: false,
  }))

  return <NewMusiqApp initialComments={comments} />
}
