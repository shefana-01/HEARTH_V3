import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { useAuth } from '@/app/AuthProvider';
import { isDemoMode } from '@/services/config';
import { Button, useToast, type ButtonProps } from '@/components/ui';

/** Loads the optional sample family and opens the dashboard. Only shown in the offline demo. */
export function SampleButton({ children = 'Explore with sample data', ...props }: Omit<ButtonProps, 'onClick' | 'loading'>) {
  const { startSample } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);

  const onClick = async () => {
    setPending(true);
    try {
      await startSample();
      navigate('/dashboard');
    } catch (e) {
      toast({ tone: 'error', title: 'Sample data isn’t available', description: e instanceof Error ? e.message : undefined });
    } finally {
      setPending(false);
    }
  };

  if (!isDemoMode) return null;
  return (
    <Button variant="secondary" leftIcon={<Sparkles aria-hidden="true" className="h-4 w-4 text-rose-500" />} loading={pending} onClick={onClick} {...props}>
      {children}
    </Button>
  );
}
