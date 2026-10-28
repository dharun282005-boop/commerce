import { setRequestLocale } from 'next-intl/server';
import DetailView from '@/components/DetailView';

export default async function Page({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <DetailView id={decodeURIComponent(id)} />;
}
