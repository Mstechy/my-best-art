import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { StarRating } from "@/components/ui/StarRating";

describe("StarRating", () => {
  it("shows the New label when the product has no ratings yet", () => {
    render(<StarRating rating={0} />);
    expect(screen.getByText("New")).toBeInTheDocument();
  });

  it("shows the New label when rating is null or undefined", () => {
    render(<StarRating rating={null} newLabel="Brand new" />);
    expect(screen.getByText("Brand new")).toBeInTheDocument();
  });

  it("renders nothing when unrated and showNewWhenUnrated is false", () => {
    const { container } = render(<StarRating rating={0} showNewWhenUnrated={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the rating to one decimal place", () => {
    render(<StarRating rating={4.6666} />);
    expect(screen.getByText("4.7")).toBeInTheDocument();
  });

  it("renders the sold count with thousands separators", () => {
    render(<StarRating rating={4.7} soldCount={2108} soldLabel="sold" />);
    expect(screen.getByText("2,108 sold")).toBeInTheDocument();
  });

  it("renders the review count when a label is supplied", () => {
    render(<StarRating rating={4.4} reviewCount={318} reviewLabel="reviews" />);
    expect(screen.getByText("318 reviews")).toBeInTheDocument();
  });

  it("does not render a review count without a label", () => {
    render(<StarRating rating={4.4} reviewCount={318} />);
    expect(screen.queryByText(/reviews/)).not.toBeInTheDocument();
  });

  it("renders a five-star row with fractional fill when showStars is set", () => {
    render(<StarRating rating={4.4} showStars />);
    // two rows of 5 outline stars: the grey track plus the coloured overlay
    expect(screen.getByRole("img", { name: "4.4 out of 5" })).toBeInTheDocument();
  });

  it("clamps the star overlay width between 0 and 100 percent", () => {
    const { container } = render(<StarRating rating={7} showStars />);
    const overlay = container.querySelector("[style]") as HTMLElement | null;
    expect(overlay?.style.width).toBe("100%");
  });
});