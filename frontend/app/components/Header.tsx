import { Link, useLocation } from 'react-router';
import { Button } from './ui/button';
import { PlusCircle, List, Sparkles, FileText, Zap } from 'lucide-react';

export function Header() {
  const location = useLocation();

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 sticky top-0 z-40">
      <div className="container mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-primary flex-shrink-0" />
          <span className="font-bold text-xl">RunningHub</span>
        </Link>

        <nav className="flex flex-wrap items-center gap-2 justify-end">
          {/* App 任务 - 批量输入模式 */}
          <Link to="/app-create">
            <Button
              variant={location.pathname === '/app-create' ? 'default' : 'ghost'}
              size="sm"
              className="gap-2"
            >
              <PlusCircle className="w-4 h-4 flex-shrink-0" />
              App任务
            </Button>
          </Link>

          <Link to="/app-tasks">
            <Button
              variant={location.pathname === '/app-tasks' ? 'default' : 'ghost'}
              size="sm"
              className="gap-2"
            >
              <List className="w-4 h-4 flex-shrink-0" />
              App列表
            </Button>
          </Link>

          {/* API 任务 */}
          <div className="w-px h-6 bg-border" />

          <Link to="/api-create">
            <Button
              variant={location.pathname === '/api-create' ? 'default' : 'ghost'}
              size="sm"
              className="gap-2"
            >
              <Zap className="w-4 h-4 flex-shrink-0" />
              API任务
            </Button>
          </Link>

          <Link to="/api-tasks">
            <Button
              variant={location.pathname === '/api-tasks' ? 'default' : 'ghost'}
              size="sm"
              className="gap-2"
            >
              <List className="w-4 h-4 flex-shrink-0" />
              API列表
            </Button>
          </Link>

          {/* 模板 - 共享 */}
          <div className="w-px h-6 bg-border" />

          <Link to="/templates">
            <Button
              variant={location.pathname === '/templates' ? 'default' : 'ghost'}
              size="sm"
              className="gap-2"
            >
              <FileText className="w-4 h-4 flex-shrink-0" />
              模板列表
            </Button>
          </Link>
        </nav>
      </div>
    </header>
  );
}
