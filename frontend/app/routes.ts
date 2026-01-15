import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("create", "routes/create.tsx"),
  route("tasks", "routes/tasks.tsx"),
  route("templates", "routes/templates.tsx"),
] satisfies RouteConfig;
