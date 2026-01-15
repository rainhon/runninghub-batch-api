import type { Route } from "./+types/home";
import { Link } from "react-router";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { PlusCircle, List } from "lucide-react";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "RunningHub - AI 任务管理平台" },
    { name: "description", content: "RunningHub AI 任务管理平台" },
  ];
}

export default function Home() {
  return (
    <div className="container mx-auto px-4 py-16">
      {/* Hero Section */}
      <div className="text-center mb-16">
        <h1 className="text-4xl font-bold mb-4">欢迎使用 RunningHub</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          AI 任务管理平台 - 与 RunningHub.cn AI 平台集成，支持任务队列管理和重复执行
        </p>
      </div>

      {/* Feature Cards */}
      <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
              <PlusCircle className="w-6 h-6 text-primary" />
            </div>
            <CardTitle>创建任务</CardTitle>
            <CardDescription>
              输入 App ID，配置节点参数，创建新的 AI 任务
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/create">
              <Button className="w-full">
                <PlusCircle className="w-4 h-4 mr-2" />
                创建新任务
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
              <List className="w-6 h-6 text-primary" />
            </div>
            <CardTitle>任务管理</CardTitle>
            <CardDescription>
              查看任务列表，监控执行状态，查看任务结果
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/tasks">
              <Button variant="outline" className="w-full">
                <List className="w-4 h-4 mr-2" />
                查看任务列表
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Info Section */}
      <div className="mt-16 text-center text-sm text-muted-foreground space-y-2">
        <p>后端服务运行在 <code className="bg-muted px-2 py-1 rounded">http://localhost:7777</code></p>
        <p className="text-xs">支持最多 2 个任务并行运行，其他任务自动进入队列</p>
      </div>
    </div>
  );
}
