export const NotFound = () => {
  return (
    <div className="relative min-h-screen text-white overflow-hidden flex flex-col items-center justify-center px-4">
      <h1 className="text-[5rem] text-gray-500">404</h1>
      <p className="text-xl">Page Not Found</p>
      <a href="/" className="mt-5 inline-block text-blue-500 hover:underline">
        Go back home
      </a>

      <img
        src="/globe_big.png"
        alt="Globe"
        className="fixed bottom-0 left-1/2 -translate-x-1/2 w-[1200px] z-0 pointer-events-none"
        loading="lazy"
      />
    </div>
  );
};
