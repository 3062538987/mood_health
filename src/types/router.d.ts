import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    public?: boolean
    guestOnly?: boolean
    adminOnly?: boolean
    subNav?: {
      path: string
      name: string
      icon: string
    }[]
  }
}

export {}
