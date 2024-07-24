"use server";

import { revalidatePath } from "next/cache";
import { auth, signIn, signOut } from "./auth";
import { supabase } from "./supabase";
import { getBookedDatesByCabinId, getBookings } from "./data-service";
import { redirect } from "next/navigation";
import { isWithinInterval } from "date-fns";
import { reservationSchema } from "./types";

export async function signInAction() {
  await signIn("google", { redirectTo: "/account" });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}

export async function updateGuest(formData) {
  const session = await auth();
  if (!session) throw new Error("You must logged in!");

  const nationalID = formData.get("nationalID");
  const [nationality, countryFlag] = formData.get("nationality").split("%");

  if (!/^[a-zA-Z0-9]{6,12}$/.test(nationalID))
    throw new Error("Please provide a valid national ID");

  const updateData = { nationality, countryFlag, nationalID };

  const { data, error } = await supabase
    .from("guests")
    .update(updateData)
    .eq("id", session.user.guestId);

  if (error) {
    throw new Error("Guest could not be updated");
  }
  revalidatePath("/account/profile");
}

export async function deleteReservation(bookingId) {
  const session = await auth();
  if (!session) throw new Error("You must logged in!");

  const guestBookings = await getBookings(session.user.guestId);
  const guestBookingsIds = guestBookings.map((booking) => booking.id);
  if (!guestBookingsIds.includes(bookingId))
    throw new error("You are not allowed to delete this booking");

  const { data, error } = await supabase
    .from("bookings")
    .delete()
    .eq("id", bookingId);

  if (error) {
    throw new Error("Booking could not be deleted");
  }

  revalidatePath("/account/reservations");
}

export async function updateReservation(bookingId, formData) {
  const session = await auth();
  if (!session) throw new Error("You must logged in!");

  const guestBookings = await getBookings(session.user.guestId);
  const guestBookingsIds = guestBookings.map((booking) => booking.id);
  if (!guestBookingsIds.includes(+bookingId))
    throw new Error("You are not allowed to update this booking");

  const updatedFields = {
    numGuests: formData.get("numGuests"),
    observations: formData.get("observations").slice(0, 1000),
  };

  //supabase protect from sql injections

  const { data, error } = await supabase
    .from("bookings")
    .update(updatedFields)
    .eq("id", +bookingId)
    .select()
    .single();

  if (error) {
    throw new Error("Booking could not be updated");
  }

  redirect("/account/reservations");
}

export async function createReservation(bookingData) {
  const session = await auth();
  if (!session) throw new Error("You must logged in!");

  const bookedDates = await getBookedDatesByCabinId(bookingData.cabinId);
  const isBooked = bookedDates.some((date) =>
    isWithinInterval(date, {
      start: bookingData.startDate,
      end: bookingData.endDate,
    })
  );
  if (isBooked) throw new Error("Booking could not be created");

  const newReservation = {
    ...bookingData,
    guestId: session.user.guestId,
    extrasPrice: 0,
    totalPrice: bookingData.cabinPrice,
    isPaid: false,
    hasBreakfast: false,
    status: "unconfirmed",
  };

  const result = reservationSchema.safeParse(newReservation);
  if (!result.success) {
    throw new Error("Booking could not be created");
  }

  const { error } = await supabase.from("bookings").insert([result.data]);

  if (error) throw new Error("Booking could not be created");

  revalidatePath("cabin/bookingData.cabinId");
  redirect("/cabins/thankyou");
}
