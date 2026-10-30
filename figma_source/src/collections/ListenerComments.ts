import type { CollectionConfig } from "payload"

export const ListenerComments: CollectionConfig = {
  slug: "listener-comments",
  admin: {
    useAsTitle: "displayName",
    defaultColumns: ["displayName", "trackKey", "status", "createdAt"],
    group: "Community",
  },
  access: {
    create: () => true,
    read: ({ req }) =>
      req.user
        ? true
        : {
            status: {
              equals: "approved",
            },
          },
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    {
      name: "displayName",
      type: "text",
      required: true,
      maxLength: 60,
    },
    {
      name: "message",
      type: "textarea",
      required: true,
      maxLength: 600,
    },
    {
      name: "trackKey",
      type: "text",
      required: true,
      defaultValue: "golden-moon",
      index: true,
      access: {
        create: () => false,
        update: ({ req }) => Boolean(req.user),
      },
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "pending",
      index: true,
      options: [
        { label: "Pending review", value: "pending" },
        { label: "Approved", value: "approved" },
        { label: "Hidden", value: "hidden" },
      ],
      access: {
        create: () => false,
        update: ({ req }) => Boolean(req.user),
      },
    },
  ],
}
