import type { PublicImage as PublicImageData } from "@/lib/api/types";
import { PhotoGallery } from "./photo-gallery";

// Galeri dokumentasi kategori (landing kategori): mozaik 4 foto, kurang dari 4 = grid sejajar.
export function CategoryGallery({ images, categoryName }: { images: PublicImageData[]; categoryName: string }) {
  return <PhotoGallery images={images} label={`Galeri ${categoryName}`} mosaic />;
}
