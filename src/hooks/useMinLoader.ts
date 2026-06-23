import { useState, useEffect } from "react";

export function useMinLoader(isLoading: boolean, minDuration = 0) {
  const [showLoader, setShowLoader] = useState(isLoading);

  useEffect(() => {
    if (isLoading) {
      setShowLoader(true);
      return;
    }

    if (minDuration <= 0) {
      setShowLoader(false);
      return;
    }

    const timer = setTimeout(() => setShowLoader(false), minDuration);
    return () => clearTimeout(timer);
  }, [isLoading, minDuration]);

  return showLoader;
}
