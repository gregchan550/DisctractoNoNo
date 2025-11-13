#!/usr/bin/env python3
from PIL import Image
import sys
import os

def remove_background(image_path, output_path):
    """Remove background from image by making corner pixels transparent"""
    img = Image.open(image_path)
    
    # Convert to RGBA if not already
    if img.mode != 'RGBA':
        img = img.convert('RGBA')
    
    # Get corner pixels to determine background color
    width, height = img.size
    corners = [
        img.getpixel((0, 0)),  # top-left
        img.getpixel((width-1, 0)),  # top-right
        img.getpixel((0, height-1)),  # bottom-left
        img.getpixel((width-1, height-1))  # bottom-right
    ]
    
    # Use the most common corner color as background
    # For simplicity, use top-left corner
    bg_color = corners[0]
    
    # Create new image data with transparency
    data = img.getdata()
    new_data = []
    
    # Threshold for color matching (adjust if needed)
    threshold = 30
    
    for item in data:
        # Check if pixel is similar to background color
        if (abs(item[0] - bg_color[0]) < threshold and
            abs(item[1] - bg_color[1]) < threshold and
            abs(item[2] - bg_color[2]) < threshold):
            # Make transparent
            new_data.append((255, 255, 255, 0))
        else:
            # Keep original pixel
            new_data.append(item)
    
    img.putdata(new_data)
    img.save(output_path, 'PNG')
    print(f"Processed {output_path}")

if __name__ == "__main__":
    icons_dir = "/Users/gregorychan/Desktop/Personal projects/DistractoNoNo/icons"
    icons = ["icon16.png", "icon48.png", "icon128.png"]
    
    for icon in icons:
        input_path = os.path.join(icons_dir, icon)
        if os.path.exists(input_path):
            remove_background(input_path, input_path)
        else:
            print(f"File not found: {input_path}")

