import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("create", "routes/create.tsx"),
  route("tasks", "routes/tasks.tsx"),
  route("templates", "routes/templates.tsx"),
  route("api-create", "routes/api-create.tsx"),
  route("api-tasks", "routes/api-tasks.tsx"),
  route("api-tasks/:id", "routes/api-task-detail.tsx"),
] satisfies RouteConfig;
