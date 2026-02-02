import type { Route } from "./+types/home";
import { Link } from "react-router";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { PlusCircle, List, Zap } from "lucide-react";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "RunningHub - AI 任务管理平台" },
    { name: "description", content: "RunningHub AI 任务管理平台 - 支持 App 任务和 API 任务" },
  ];
}

export default function Home() {
  return (
    <div className="container mx-auto px-4 py-16">
      {/* Hero Section */}
      <div className="text-center mb-16">
        <h1 className="text-4xl font-bold mb-4">欢迎使用 RunningHub</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          AI 任务管理平台 - 与 RunningHub.cn AI 平台集成，支持 App 任务和 API 任务管理
        </p>
      </div>

      {/* Feature Cards */}
      <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-8">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
              <PlusCircle className="w-6 h-6 text-primary" />
            </div>
            <CardTitle>创建 App 任务</CardTitle>
            <CardDescription>
              批量输入模式 - 为每个参数添加多个值，自动生成所有组合（笛卡尔积）
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/app-create">
              <Button className="w-full">
                <PlusCircle className="w-4 h-4 mr-2" />
                创建 App 任务
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
              <List className="w-6 h-6 text-primary" />
            </div>
            <CardTitle>App 任务管理</CardTitle>
            <CardDescription>
              查看 App 任务列表，监控执行状态，查看任务结果
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/app-tasks">
              <Button variant="outline" className="w-full">
                <List className="w-4 h-4 mr-2" />
                查看 App 列表
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* API Tasks Section */}
      <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="w-12 h-12 bg-orange-500/10 rounded-lg flex items-center justify-center mb-4">
              <Zap className="w-6 h-6 text-orange-500" />
            </div>
            <CardTitle>创建 API 任务</CardTitle>
            <CardDescription>
              直接调用 API，支持批量文生图、图生图、文生视频
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/api-create">
              <Button className="w-full" variant="secondary">
                <Zap className="w-4 h-4 mr-2" />
                创建 API 任务
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="w-12 h-12 bg-orange-500/10 rounded-lg flex items-center justify-center mb-4">
              <List className="w-6 h-6 text-orange-500" />
            </div>
            <CardTitle>API 任务管理</CardTitle>
            <CardDescription>
              查看 API 任务列表，支持 50 个并发批量任务
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/api-tasks">
              <Button variant="outline" className="w-full">
                <List className="w-4 h-4 mr-2" />
                查看 API 列表
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Info Section */}
      <div className="mt-16 text-center text-sm text-muted-foreground space-y-2">
        <p>后端服务运行在 <code className="bg-muted px-2 py-1 rounded">http://localhost:7777</code></p>
        <p className="text-xs">App 任务：最多 2 个并行 | API 任务：最多 50 个并行</p>
      </div>
    </div>
  );
}
