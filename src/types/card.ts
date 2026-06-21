export interface YgoCardImage {
  id: number;
  image_url: string;
  image_url_small: string;
  image_url_cropped: string;
}

export interface YgoCardSet {
  set_name: string;
  set_code: string;
  set_rarity: string;
  set_rarity_code: string;
  set_price: string;
}

export interface YgoCard {
  id: number;
  name: string;
  name_en?: string;
  type: string;
  humanReadableCardType: string;
  frameType: string;
  desc: string;
  race: string;
  archetype?: string;
  attribute?: string;
  level?: number;
  atk?: number;
  def?: number;
  card_images: YgoCardImage[];
  card_sets?: YgoCardSet[];
  typeline?: string[];
}

export interface YgoApiResponse {
  data: YgoCard[];
  meta?: {
    total_rows: number;
    rows_remaining: number;
    next_page?: string;
    next_page_offset?: number;
  };
}
