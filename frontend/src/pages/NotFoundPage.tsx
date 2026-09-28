import { Compass } from 'lucide-react';
import { StatusPage } from '../components/StatusPage';

export function NotFoundPage() {
  return <StatusPage code="404" icon={Compass} title="Page not found" message="The page you're looking for doesn't exist or has moved." />;
}
