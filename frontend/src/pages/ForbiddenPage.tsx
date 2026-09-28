import { ShieldOff } from 'lucide-react';
import { StatusPage } from '../components/StatusPage';

export function ForbiddenPage() {
  return <StatusPage code="403" icon={ShieldOff} title="You don't have access" message="This page isn't part of your role's workspace. Ask an administrator if you need access." />;
}
