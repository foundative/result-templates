import { Product } from "@/components/product";

export default async function ProductPage({
  params,
}: {
  readonly params: Promise<{ slug: string }>;
}) {
  return <Product slug={(await params).slug} />;
}
