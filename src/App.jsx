import React, { useState } from "react";

import Header from "./tbw/layout/Header";
import Hero from "./tbw/layout/Hero";
import AISearch from "./tbw/search/AISearch";
import BookingModal from "./tbw/booking/BookingModal";

export default function App() {
  const [bookingOpen, setBookingOpen] = useState(false);

  return (
    <div className="tbw-app">
      <Header onOpenBooking={() => setBookingOpen(true)} />
      <Hero />

      <div className="tbw-scroll">
        <AISearch onOpenBooking={() => setBookingOpen(true)} />
      </div>

      {bookingOpen && <BookingModal onClose={() => setBookingOpen(false)} />}
    </div>
  );
}

