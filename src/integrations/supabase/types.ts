export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      addresses: {
        Row: {
          city: string
          country: string
          created_at: string
          id: string
          is_default: boolean
          label: string | null
          line1: string
          line2: string | null
          phone: string | null
          postal_code: string | null
          recipient: string
          region: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          city: string
          country?: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string | null
          line1: string
          line2?: string | null
          phone?: string | null
          postal_code?: string | null
          recipient: string
          region?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          city?: string
          country?: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string | null
          line1?: string
          line2?: string | null
          phone?: string | null
          postal_code?: string | null
          recipient?: string
          region?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ads: {
        Row: {
          budget: number
          clicks: number
          created_at: string
          end_date: string | null
          id: string
          image_url: string | null
          impressions: number
          placement: Database["public"]["Enums"]["ad_placement"]
          seller_id: string | null
          spent: number
          start_date: string | null
          status: Database["public"]["Enums"]["ad_status"]
          target_url: string | null
          title: string
        }
        Insert: {
          budget?: number
          clicks?: number
          created_at?: string
          end_date?: string | null
          id?: string
          image_url?: string | null
          impressions?: number
          placement?: Database["public"]["Enums"]["ad_placement"]
          seller_id?: string | null
          spent?: number
          start_date?: string | null
          status?: Database["public"]["Enums"]["ad_status"]
          target_url?: string | null
          title: string
        }
        Update: {
          budget?: number
          clicks?: number
          created_at?: string
          end_date?: string | null
          id?: string
          image_url?: string | null
          impressions?: number
          placement?: Database["public"]["Enums"]["ad_placement"]
          seller_id?: string | null
          spent?: number
          start_date?: string | null
          status?: Database["public"]["Enums"]["ad_status"]
          target_url?: string | null
          title?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          icon: string | null
          id: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          icon?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          icon?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      marketplace_collection_products: {
        Row: {
          collection_id: string
          created_at: string
          product_id: string
          sort_order: number
        }
        Insert: {
          collection_id: string
          created_at?: string
          product_id: string
          sort_order?: number
        }
        Update: {
          collection_id?: string
          created_at?: string
          product_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_collection_products_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "marketplace_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_collection_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_collections: {
        Row: {
          badge: string | null
          created_at: string
          created_by: string | null
          cta_label: string
          description: string | null
          ends_at: string | null
          id: string
          image_url: string | null
          placement: string
          slug: string
          sort_order: number
          starts_at: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          badge?: string | null
          created_at?: string
          created_by?: string | null
          cta_label?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          image_url?: string | null
          placement?: string
          slug: string
          sort_order?: number
          starts_at?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          badge?: string | null
          created_at?: string
          created_by?: string | null
          cta_label?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          image_url?: string | null
          placement?: string
          slug?: string
          sort_order?: number
          starts_at?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      currency_rates: {
        Row: {
          code: string
          rate_to_usd: number
          symbol: string
          updated_at: string
        }
        Insert: {
          code: string
          rate_to_usd: number
          symbol: string
          updated_at?: string
        }
        Update: {
          code?: string
          rate_to_usd?: number
          symbol?: string
          updated_at?: string
        }
        Relationships: []
      }
      dispute_updates: {
        Row: {
          attachment_url: string | null
          author_id: string
          created_at: string
          dispute_id: string
          id: string
          note: string | null
        }
        Insert: {
          attachment_url?: string | null
          author_id: string
          created_at?: string
          dispute_id: string
          id?: string
          note?: string | null
        }
        Update: {
          attachment_url?: string | null
          author_id?: string
          created_at?: string
          dispute_id?: string
          id?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dispute_updates_dispute_id_fkey"
            columns: ["dispute_id"]
            isOneToOne: false
            referencedRelation: "disputes"
            referencedColumns: ["id"]
          },
        ]
      }
      disputes: {
        Row: {
          admin_notes: string | null
          buyer_id: string
          created_at: string
          description: string | null
          id: string
          order_id: string | null
          proof_url: string | null
          reason: string
          resolved_at: string | null
          seller_id: string
          status: Database["public"]["Enums"]["dispute_status"]
        }
        Insert: {
          admin_notes?: string | null
          buyer_id: string
          created_at?: string
          description?: string | null
          id?: string
          order_id?: string | null
          proof_url?: string | null
          reason: string
          resolved_at?: string | null
          seller_id: string
          status?: Database["public"]["Enums"]["dispute_status"]
        }
        Update: {
          admin_notes?: string | null
          buyer_id?: string
          created_at?: string
          description?: string | null
          id?: string
          order_id?: string | null
          proof_url?: string | null
          reason?: string
          resolved_at?: string | null
          seller_id?: string
          status?: Database["public"]["Enums"]["dispute_status"]
        }
        Relationships: [
          {
            foreignKeyName: "disputes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          is_read: boolean
          receiver_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_read?: boolean
          receiver_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_read?: boolean
          receiver_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      offers: {
        Row: {
          amount: number
          attachment_url: string | null
          buyer_id: string
          created_at: string
          currency: string
          expires_at: string
          id: string
          note: string | null
          parent_offer_id: string | null
          product_id: string
          responded_at: string | null
          seller_id: string
          status: Database["public"]["Enums"]["offer_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          attachment_url?: string | null
          buyer_id: string
          created_at?: string
          currency?: string
          expires_at?: string
          id?: string
          note?: string | null
          parent_offer_id?: string | null
          product_id: string
          responded_at?: string | null
          seller_id: string
          status?: Database["public"]["Enums"]["offer_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          attachment_url?: string | null
          buyer_id?: string
          created_at?: string
          currency?: string
          expires_at?: string
          id?: string
          note?: string | null
          parent_offer_id?: string | null
          product_id?: string
          responded_at?: string | null
          seller_id?: string
          status?: Database["public"]["Enums"]["offer_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offers_parent_offer_id_fkey"
            columns: ["parent_offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
      }
      order_cancellations: {
        Row: {
          buyer_id: string
          created_at: string
          note: string | null
          order_id: string
          reason: string
        }
        Insert: {
          buyer_id: string
          created_at?: string
          note?: string | null
          order_id: string
          reason: string
        }
        Update: {
          buyer_id?: string
          created_at?: string
          note?: string | null
          order_id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_cancellations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          product_id: string | null
          product_variant_id: string | null
          quantity: number
          total_price: number
          unit_price: number
        }
        Insert: {
          id?: string
          order_id: string
          product_id?: string | null
          product_variant_id?: string | null
          quantity?: number
          total_price: number
          unit_price: number
        }
        Update: {
          id?: string
          order_id?: string
          product_id?: string | null
          product_variant_id?: string | null
          quantity?: number
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          buyer_id: string
          carrier: string | null
          created_at: string
          currency: string
          delivered_at: string | null
          estimated_delivery: string | null
          id: string
          seller_id: string
          shipped_at: string | null
          shipping_address: Json | null
          status: Database["public"]["Enums"]["order_status"]
          status_history: Json
          total_amount: number
          tracking_number: string | null
          updated_at: string
        }
        Insert: {
          buyer_id: string
          carrier?: string | null
          created_at?: string
          currency?: string
          delivered_at?: string | null
          estimated_delivery?: string | null
          id?: string
          seller_id: string
          shipped_at?: string | null
          shipping_address?: Json | null
          status?: Database["public"]["Enums"]["order_status"]
          status_history?: Json
          total_amount?: number
          tracking_number?: string | null
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          carrier?: string | null
          created_at?: string
          currency?: string
          delivered_at?: string | null
          estimated_delivery?: string | null
          id?: string
          seller_id?: string
          shipped_at?: string | null
          shipping_address?: Json | null
          status?: Database["public"]["Enums"]["order_status"]
          status_history?: Json
          total_amount?: number
          tracking_number?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      payout_methods: {
        Row: {
          created_at: string
          details: Json
          id: string
          is_default: boolean
          seller_id: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          details?: Json
          id?: string
          is_default?: boolean
          seller_id: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          details?: Json
          id?: string
          is_default?: boolean
          seller_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_documents: {
        Row: {
          created_at: string
          id: string
          label: string | null
          product_id: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          product_id: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          product_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_documents_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          id: string
          image_url: string
          is_primary: boolean
          product_id: string
          sort_order: number
        }
        Insert: {
          id?: string
          image_url: string
          is_primary?: boolean
          product_id: string
          sort_order?: number
        }
        Update: {
          id?: string
          image_url?: string
          is_primary?: boolean
          product_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_question_answers: {
        Row: {
          answerer_id: string
          body: string
          created_at: string
          id: string
          question_id: string
        }
        Insert: {
          answerer_id: string
          body: string
          created_at?: string
          id?: string
          question_id: string
        }
        Update: {
          answerer_id?: string
          body?: string
          created_at?: string
          id?: string
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_question_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "product_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      product_questions: {
        Row: {
          asker_id: string
          created_at: string
          id: string
          product_id: string
          question: string
        }
        Insert: {
          asker_id: string
          created_at?: string
          id?: string
          product_id: string
          question: string
        }
        Update: {
          asker_id?: string
          created_at?: string
          id?: string
          product_id?: string
          question?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_questions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_views: {
        Row: {
          created_at: string
          id: string
          product_id: string
          viewer_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          viewer_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          viewer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_views_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          average_rating: number
          brand: string | null
          category_id: string | null
          color: string | null
          compare_at_price: number | null
          condition: string | null
          created_at: string
          currency: string
          description: string | null
          dimensions: string | null
          id: string
          is_approved: boolean
          key_features: string[] | null
          material: string | null
          price: number
          review_count: number
          seller_id: string
          shipping_info: string | null
          ships_to: string[]
          show_sold_count: boolean
          sku: string | null
          status: Database["public"]["Enums"]["product_status"]
          stock_quantity: number
          tags: string[] | null
          title: string
          updated_at: string
          variants: Json
          warranty: string | null
          warranty_period: string | null
          weight: string | null
        }
        Insert: {
          average_rating?: number
          brand?: string | null
          category_id?: string | null
          color?: string | null
          compare_at_price?: number | null
          condition?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          dimensions?: string | null
          id?: string
          is_approved?: boolean
          key_features?: string[] | null
          material?: string | null
          price?: number
          review_count?: number
          seller_id: string
          shipping_info?: string | null
          ships_to?: string[]
          show_sold_count?: boolean
          sku?: string | null
          status?: Database["public"]["Enums"]["product_status"]
          stock_quantity?: number
          tags?: string[] | null
          title: string
          updated_at?: string
          variants?: Json
          warranty?: string | null
          warranty_period?: string | null
          weight?: string | null
        }
        Update: {
          average_rating?: number
          brand?: string | null
          category_id?: string | null
          color?: string | null
          compare_at_price?: number | null
          condition?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          dimensions?: string | null
          id?: string
          is_approved?: boolean
          key_features?: string[] | null
          material?: string | null
          price?: number
          review_count?: number
          seller_id?: string
          shipping_info?: string | null
          ships_to?: string[]
          show_sold_count?: boolean
          sku?: string | null
          status?: Database["public"]["Enums"]["product_status"]
          stock_quantity?: number
          tags?: string[] | null
          title?: string
          updated_at?: string
          variants?: Json
          warranty?: string | null
          warranty_period?: string | null
          weight?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          compare_at_price: number | null
          created_at: string
          id: string
          image_url: string | null
          is_active: boolean
          option_values: Json
          price: number | null
          product_id: string
          sku: string | null
          sort_order: number
          stock_quantity: number
          updated_at: string
        }
        Insert: {
          compare_at_price?: number | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          option_values?: Json
          price?: number | null
          product_id: string
          sku?: string | null
          sort_order?: number
          stock_quantity?: number
          updated_at?: string
        }
        Update: {
          compare_at_price?: number | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          option_values?: Json
          price?: number | null
          product_id?: string
          sku?: string | null
          sort_order?: number
          stock_quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          country: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_approved: boolean
          is_banned: boolean
          is_frozen: boolean
          is_verified: boolean
          phone: string | null
          preferred_currency: string | null
          preferred_language: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          is_approved?: boolean
          is_banned?: boolean
          is_frozen?: boolean
          is_verified?: boolean
          phone?: string | null
          preferred_currency?: string | null
          preferred_language?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_approved?: boolean
          is_banned?: boolean
          is_frozen?: boolean
          is_verified?: boolean
          phone?: string | null
          preferred_currency?: string | null
          preferred_language?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      review_photos: {
        Row: {
          created_at: string
          id: string
          position: number
          review_id: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          position?: number
          review_id: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          position?: number
          review_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_photos_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      review_pins: {
        Row: {
          pinned_at: string
          pinned_by: string
          review_id: string
        }
        Insert: {
          pinned_at?: string
          pinned_by: string
          review_id: string
        }
        Update: {
          pinned_at?: string
          pinned_by?: string
          review_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_pins_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: true
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      review_replies: {
        Row: {
          body: string
          created_at: string
          review_id: string
          seller_id: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          review_id: string
          seller_id: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          review_id?: string
          seller_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_replies_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: true
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          buyer_id: string
          comment: string | null
          created_at: string
          id: string
          is_approved: boolean
          is_verified_purchase: boolean
          order_id: string | null
          product_id: string
          rating: number
          seller_id: string
          subrating_communication: number | null
          subrating_description: number | null
          subrating_shipping: number | null
          title: string | null
          updated_at: string
        }
        Insert: {
          buyer_id: string
          comment?: string | null
          created_at?: string
          id?: string
          is_approved?: boolean
          is_verified_purchase?: boolean
          order_id?: string | null
          product_id: string
          rating: number
          seller_id: string
          subrating_communication?: number | null
          subrating_description?: number | null
          subrating_shipping?: number | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          is_approved?: boolean
          is_verified_purchase?: boolean
          order_id?: string | null
          product_id?: string
          rating?: number
          seller_id?: string
          subrating_communication?: number | null
          subrating_description?: number | null
          subrating_shipping?: number | null
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      seller_stores: {
        Row: {
          banner_url: string | null
          bio: string | null
          created_at: string
          logo_url: string | null
          payment_policy: string | null
          return_policy: string | null
          seller_id: string
          shipping_policy: string | null
          ships_to: string[]
          updated_at: string
        }
        Insert: {
          banner_url?: string | null
          bio?: string | null
          created_at?: string
          logo_url?: string | null
          payment_policy?: string | null
          return_policy?: string | null
          seller_id: string
          shipping_policy?: string | null
          ships_to?: string[]
          updated_at?: string
        }
        Update: {
          banner_url?: string | null
          bio?: string | null
          created_at?: string
          logo_url?: string | null
          payment_policy?: string | null
          return_policy?: string | null
          seller_id?: string
          shipping_policy?: string | null
          ships_to?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      seller_wallets: {
        Row: {
          available_balance: number
          balance: number
          created_at: string
          currency: string
          id: string
          pending_balance: number
          seller_id: string
          total_earned: number
          updated_at: string
        }
        Insert: {
          available_balance?: number
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          pending_balance?: number
          seller_id: string
          total_earned?: number
          updated_at?: string
        }
        Update: {
          available_balance?: number
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          pending_balance?: number
          seller_id?: string
          total_earned?: number
          updated_at?: string
        }
        Relationships: []
      }
      site_pages: {
        Row: {
          body_markdown: string
          slug: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body_markdown?: string
          slug: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body_markdown?: string
          slug?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      store_follows: {
        Row: {
          created_at: string
          follower_id: string
          id: string
          seller_id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          id?: string
          seller_id: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          id?: string
          seller_id?: string
        }
        Relationships: []
      }
      system_alerts: {
        Row: {
          created_at: string
          id: string
          level: Database["public"]["Enums"]["alert_level"]
          message: string
          metadata: Json | null
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          source: string
        }
        Insert: {
          created_at?: string
          id?: string
          level?: Database["public"]["Enums"]["alert_level"]
          message: string
          metadata?: Json | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          source: string
        }
        Update: {
          created_at?: string
          id?: string
          level?: Database["public"]["Enums"]["alert_level"]
          message?: string
          metadata?: Json | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          source?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          reference_id: string | null
          type: Database["public"]["Enums"]["wallet_tx_type"]
          wallet_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          type: Database["public"]["Enums"]["wallet_tx_type"]
          wallet_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          type?: Database["public"]["Enums"]["wallet_tx_type"]
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "seller_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      wishlists: {
        Row: {
          created_at: string
          id: string
          is_public: boolean
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_public?: boolean
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_public?: boolean
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlists_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      ads_public: {
        Row: {
          id: string | null
          image_url: string | null
          placement: Database["public"]["Enums"]["ad_placement"] | null
          seller_id: string | null
          status: Database["public"]["Enums"]["ad_status"] | null
          target_url: string | null
          title: string | null
        }
        Insert: {
          id?: string | null
          image_url?: string | null
          placement?: Database["public"]["Enums"]["ad_placement"] | null
          seller_id?: string | null
          status?: Database["public"]["Enums"]["ad_status"] | null
          target_url?: string | null
          title?: string | null
        }
        Update: {
          id?: string | null
          image_url?: string | null
          placement?: Database["public"]["Enums"]["ad_placement"] | null
          seller_id?: string | null
          status?: Database["public"]["Enums"]["ad_status"] | null
          target_url?: string | null
          title?: string | null
        }
        Relationships: []
      }
      seller_profiles_public: {
        Row: {
          avatar_url: string | null
          country: string | null
          created_at: string | null
          full_name: string | null
          is_approved: boolean | null
          is_verified: boolean | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          country?: string | null
          created_at?: string | null
          full_name?: string | null
          is_approved?: boolean | null
          is_verified?: boolean | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          country?: string | null
          created_at?: string | null
          full_name?: string | null
          is_approved?: boolean | null
          is_verified?: boolean | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      place_marketplace_order: {
        Args: { p_items: Json; p_seller_id: string; p_shipping_address: Json }
        Returns: string
      }
      admin_grant_seller: { Args: { _user_id: string }; Returns: undefined }
      admin_platform_counts: {
        Args: never
        Returns: {
          buyers: number
          disputes: number
          orders: number
          pending_products: number
          pending_sellers: number
          products: number
          revenue: number
          sellers: number
          total_users: number
        }[]
      }
      admin_revoke_seller: { Args: { _user_id: string }; Returns: undefined }
      admin_set_account_status: {
        Args: {
          _is_approved?: boolean
          _is_banned?: boolean
          _is_frozen?: boolean
          _is_verified?: boolean
          _user_id: string
        }
        Returns: undefined
      }
      admin_set_product_approval: {
        Args: {
          _is_approved: boolean
          _product_id: string
          _status?: Database["public"]["Enums"]["product_status"]
        }
        Returns: undefined
      }
      admin_user_directory: {
        Args: never
        Returns: {
          created_at: string
          email: string
          full_name: string
          is_approved: boolean
          is_banned: boolean
          is_frozen: boolean
          is_verified: boolean
          order_count: number
          primary_role: Database["public"]["Enums"]["app_role"]
          product_count: number
          roles: Database["public"]["Enums"]["app_role"][]
          seller_capable: boolean
          user_id: string
        }[]
      }
      ensure_user_profile: {
        Args: never
        Returns: {
          profile_ready: boolean
          user_role: Database["public"]["Enums"]["app_role"]
        }[]
      }
      expire_stale_offers: { Args: never; Returns: number }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_seller_capable: { Args: { _user_id: string }; Returns: boolean }
      product_review_keywords: {
        Args: { _product_id: string }
        Returns: {
          count: number
          keyword: string
        }[]
      }
      product_sold_count: { Args: { _product_id: string }; Returns: number }
      refresh_product_review_summary: {
        Args: { _product_id: string }
        Returns: undefined
      }
      search_marketplace_product_ids: {
        Args: {
          p_category_id?: string | null
          p_attribute_filters?: Json
          p_condition?: string | null
          p_country?: string | null
          p_cursor_created_at?: string | null
          p_cursor_id?: string | null
          p_cursor_relevance?: number | null
          p_in_stock_only?: boolean
          p_limit?: number
          p_max_price?: number | null
          p_min_price?: number | null
          p_min_rating?: number | null
          p_query?: string
          p_sort?: string
        }
        Returns: {
          created_at: string
          product_id: string
          relevance: number
        }[]
      }
      marketplace_search_suggestions: {
        Args: { p_limit?: number; p_query: string }
        Returns: { category_id: string | null; label: string; suggestion_type: string }[]
      }
      store_credibility: {
        Args: { _seller_id: string }
        Returns: {
          avg_communication: number
          avg_description: number
          avg_rating: number
          avg_shipping: number
          negative: number
          neutral: number
          positive: number
          total: number
        }[]
      }
      track_product_discovery_event: {
        Args: { p_event_type: string; p_product_ids: string[]; p_visitor_id?: string | null }
        Returns: undefined
      }
      track_ad_click: { Args: { _ad_id: string }; Returns: undefined }
      track_ad_impression: { Args: { _ad_id: string }; Returns: undefined }
    }
    Enums: {
      ad_placement: "banner" | "sidebar" | "featured"
      ad_status: "active" | "paused" | "ended"
      alert_level: "info" | "warning" | "critical"
      app_role: "admin" | "seller" | "buyer"
      dispute_status: "open" | "investigating" | "resolved" | "dismissed"
      offer_status:
        | "pending"
        | "accepted"
        | "countered"
        | "rejected"
        | "expired"
        | "cancelled"
      order_status:
        | "pending"
        | "processing"
        | "shipped"
        | "delivered"
        | "cancelled"
        | "disputed"
      product_status: "draft" | "active" | "archived"
      wallet_tx_type: "sale" | "withdrawal" | "fee" | "refund"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      ad_placement: ["banner", "sidebar", "featured"],
      ad_status: ["active", "paused", "ended"],
      alert_level: ["info", "warning", "critical"],
      app_role: ["admin", "seller", "buyer"],
      dispute_status: ["open", "investigating", "resolved", "dismissed"],
      offer_status: [
        "pending",
        "accepted",
        "countered",
        "rejected",
        "expired",
        "cancelled",
      ],
      order_status: [
        "pending",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
        "disputed",
      ],
      product_status: ["draft", "active", "archived"],
      wallet_tx_type: ["sale", "withdrawal", "fee", "refund"],
    },
  },
} as const
