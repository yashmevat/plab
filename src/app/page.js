import { Suspense } from 'react';
import BooksList from './BooksList';

export default function Home() {
  return (
    <Suspense fallback={<p>Loading...</p>}>
      <BooksList />
    </Suspense>
  );
}
