import { Link, useLocation } from 'react-router';
import { Button } from './ui/button';
import { PlusCircle, List, Sparkles, FileText } from 'lucide-react';

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
          <Link to="/create">
            <Button
              variant={location.pathname === '/create' ? 'default' : 'ghost'}
              size="sm"
              className="gap-2"
            >
              <PlusCircle className="w-4 h-4 flex-shrink-0" />
              创建任务
            </Button>
          </Link>

          <Link to="/tasks">
            <Button
              variant={location.pathname === '/tasks' ? 'default' : 'ghost'}
              size="sm"
              className="gap-2"
            >
              <List className="w-4 h-4 flex-shrink-0" />
              任务列表
            </Button>
          </Link>

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
