#!/usr/bin/env python3
"""
Comic Panel Segmentation Service
Based on ComicPanelSegmentation by reidenong
https://github.com/reidenong/ComicPanelSegmentation
"""

import os
import sys
import json
import base64
import numpy as np
import cv2
import math
from io import BytesIO
from PIL import Image
from skimage.feature import canny
from skimage.color import rgb2gray
from skimage.transform import probabilistic_hough_line

def protractor(line):
    """Calculate angle of a line in degrees"""
    p0, p1 = line
    x0, y0 = p0
    x1, y1 = p1
    if x1 - x0 == 0:
        angle_rad = np.arctan(np.inf)
    else:
        angle_rad = np.arctan((y1 - y0) / (x1 - x0))
    angle = angle_rad * 180 / math.pi
    return angle

def in_line(line1, line2, orientation):
    """Check if two lines are inline"""
    (p1r, p1c), (p2r, p2c) = line1
    (par, pac), (pbr, pbc) = line2

    if orientation:  # horizontal
        if (p1r == par) and (p2r == pbr):
            return True
        else:
            return False
    else:  # vertical
        if (p1c == pac) and (p2c == pbc):
            return True
        else:
            return False

def merge_line(line1, line2, orientation, distance):
    """Merge two collinear lines if they're close enough"""
    row_list = [0, 0, 0, 0]
    col_list = [0, 0, 0, 0]
    
    (row_list[0], col_list[0]), (row_list[1], col_list[1]) = line1
    (row_list[2], col_list[2]), (row_list[3], col_list[3]) = line2
    row_list.sort()
    col_list.sort()
    
    if orientation:  # horizontal, merge by column
        if col_list[2] - col_list[1] <= distance:
            return ((row_list[0], col_list[0]), (row_list[3], col_list[3]))
        else:
            return line1
    else:  # vertical, merge by row
        if row_list[2] - row_list[1] <= distance:
            return ((row_list[0], col_list[0]), (row_list[3], col_list[3]))
        else:
            return line1

def line_len(line):
    """Calculate length of a line"""
    (a, b), (c, d) = line
    return max(abs(a - c), abs(b - d))

def new_parallel_merge(lst, merge_threshold):
    """Merge parallel lines that are close together"""
    lst = list(set(lst))
    lst.sort()
    curr_xvalue = 0
    for i in range(len(lst)):
        if abs(lst[i] - curr_xvalue) <= merge_threshold:
            lst[i] = curr_xvalue
        else:
            curr_xvalue = lst[i]
    lst = list(set(lst))
    lst.sort()
    return lst

def verticalcuts(lb, ub, vlist):
    """Find vertical cutting lines within given bounds"""
    lst = []
    for line in vlist:
        (x, a), (y, b) = line
        if a <= lb and b >= ub:
            lst += [x]
    lst = list(dict.fromkeys(lst))
    if lst == []:
        return False
    else:
        return lst

def remove_black_borders(image):
    """
    Remove black borders and background areas from the image
    """
    # Convert to grayscale for analysis
    gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
    
    # Find non-black pixels (threshold for "black" can be adjusted)
    # Increased threshold from 30 to 15 to be more conservative about what's considered "black"
    # This prevents dark gray areas from being treated as black borders
    non_black_mask = gray > 15  # Pixels with value > 15 are considered non-black
    
    # Find bounding box of non-black content
    coords = np.column_stack(np.where(non_black_mask))
    if len(coords) == 0:
        return image, (0, 0, image.shape[1], image.shape[0])
    
    y_min, x_min = coords.min(axis=0)
    y_max, x_max = coords.max(axis=0)
    
    # Add small padding
    padding = 5
    y_min = max(0, y_min - padding)
    x_min = max(0, x_min - padding)
    y_max = min(image.shape[0], y_max + padding)
    x_max = min(image.shape[1], x_max + padding)
    
    # Crop the image
    cropped = image[y_min:y_max, x_min:x_max]
    return cropped, (x_min, y_min, x_max - x_min, y_max - y_min)

def detect_panels_contour_based(image):
    """
    Detect panels using improved contour-based approach
    """
    # Convert to grayscale
    gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
    
    # Try multiple threshold approaches
    panel_boxes = []
    
    # Method 1: Edge detection + contours with adjusted parameters for black areas
    # Increased lower threshold to reduce sensitivity to internal black area edges
    edges = cv2.Canny(gray, 80, 200, apertureSize=3)  # Increased from 50,150 to 80,200
    
    # Use smaller kernel and fewer iterations to avoid connecting internal edges
    kernel = np.ones((2, 2), np.uint8)  # Reduced from (3,3) to (2,2)
    edges = cv2.dilate(edges, kernel, iterations=1)
    
    # Apply morphological closing to connect panel borders but not internal features
    kernel_close = np.ones((5, 5), np.uint8)
    edges = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel_close)
    
    # Find contours from edges
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    # Filter contours by area and aspect ratio - made more conservative
    min_area = (image.shape[0] * image.shape[1]) * 0.02  # Increased from 0.005 to 0.02 (2% of image area)
    max_area = (image.shape[0] * image.shape[1]) * 0.9    # At most 90% of image area
    
    for contour in contours:
        area = cv2.contourArea(contour)
        if min_area < area < max_area:
            x, y, w, h = cv2.boundingRect(contour)
            # Filter by size and aspect ratio - increased minimum size
            if w > 100 and h > 100:  # Increased minimum panel size from 50 to 100
                aspect_ratio = w / h
                if 0.2 < aspect_ratio < 10:  # More restrictive aspect ratios (was 0.1 to 20)
                    # Additional check: ensure the contour represents a panel border, not internal content
                    # Check if the contour is near the image edges (likely panel borders)
                    near_edge = (x < 20 or y < 20 or 
                               x + w > image.shape[1] - 20 or 
                               y + h > image.shape[0] - 20)
                    
                    # Or check if it's a large enough area to be a panel
                    large_enough = area > (image.shape[0] * image.shape[1]) * 0.05
                    
                    if near_edge or large_enough:
                        panel_boxes.append((x, y, w, h))
    
    # Method 2: If edge detection didn't work well, try adaptive threshold
    if len(panel_boxes) < 2:
        # Apply Gaussian blur
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        
        # Try different threshold methods with more conservative parameters
        for block_size in [15, 21]:  # Removed 11 to avoid small features
            for c_value in [5, 10]:  # Removed 2 to be less sensitive
                thresh = cv2.adaptiveThreshold(blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                                             cv2.THRESH_BINARY_INV, block_size, c_value)
                
                # Morphological operations to clean up noise
                kernel = np.ones((7, 7), np.uint8)  # Increased kernel size
                thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
                thresh = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel)
                
                # Find contours
                contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                
                for contour in contours:
                    area = cv2.contourArea(contour)
                    if min_area < area < max_area:
                        x, y, w, h = cv2.boundingRect(contour)
                        if w > 100 and h > 100:  # Increased minimum size here too
                            aspect_ratio = w / h
                            if 0.2 < aspect_ratio < 10:  # More restrictive aspect ratios
                                # Check if this box is not already covered
                                is_duplicate = False
                                for existing_x, existing_y, existing_w, existing_h in panel_boxes:
                                    # Check overlap
                                    overlap_x = max(0, min(x + w, existing_x + existing_w) - max(x, existing_x))
                                    overlap_y = max(0, min(y + h, existing_y + existing_h) - max(y, existing_y))
                                    overlap_area = overlap_x * overlap_y
                                    current_area = w * h
                                    if overlap_area > current_area * 0.5:  # 50% overlap threshold
                                        is_duplicate = True
                                        break
                                
                                if not is_duplicate:
                                    panel_boxes.append((x, y, w, h))
                
                # If we found enough panels, break
                if len(panel_boxes) >= 3:
                    break
            if len(panel_boxes) >= 3:
                break
    
    # Remove overlapping boxes (keep larger ones)
    filtered_boxes = []
    panel_boxes.sort(key=lambda box: box[2] * box[3], reverse=True)  # Sort by area, largest first
    
    for box in panel_boxes:
        x, y, w, h = box
        is_overlapping = False
        
        for existing_box in filtered_boxes:
            ex, ey, ew, eh = existing_box
            # Check overlap
            overlap_x = max(0, min(x + w, ex + ew) - max(x, ex))
            overlap_y = max(0, min(y + h, ey + eh) - max(y, ey))
            overlap_area = overlap_x * overlap_y
            current_area = w * h
            
            if overlap_area > current_area * 0.3:  # 30% overlap threshold
                is_overlapping = True
                break
        
        if not is_overlapping:
            filtered_boxes.append(box)
    
    return filtered_boxes

def segment_manga_panels(image_base64):
    """
    Improved manga panel segmentation with better black area handling
    """
    try:
        # Decode base64 image
        image_data = base64.b64decode(image_base64)
        image = Image.open(BytesIO(image_data))
        
        # Convert to numpy array
        im = np.array(image.convert('RGB'))
        original_height, original_width = im.shape[:2]
        
        # Remove black borders first
        cropped_im, crop_info = remove_black_borders(im)
        crop_x, crop_y, crop_w, crop_h = crop_info
        
        # Try contour-based detection first
        contour_panels = detect_panels_contour_based(cropped_im)
        
        # If contour detection finds reasonable panels, use those
        if len(contour_panels) > 1:
            panels = []
            for i, (x, y, w, h) in enumerate(contour_panels):
                # Adjust coordinates back to original image space
                orig_x = x + crop_x
                orig_y = y + crop_y
                
                # Extract panel image from original
                panel_img = im[orig_y:orig_y+h, orig_x:orig_x+w]
                
                # Convert to base64
                pil_img = Image.fromarray(panel_img)
                buffer = BytesIO()
                pil_img.save(buffer, format='JPEG')
                panel_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
                
                panel_data = {
                    "id": f"panel_{i}",
                    "boundingBox": {
                        "x": int(orig_x),
                        "y": int(orig_y),
                        "width": int(w),
                        "height": int(h)
                    },
                    "imageData": panel_base64,
                    "readingOrderIndex": i
                }
                panels.append(panel_data)
            
            # Sort panels for manga reading order (right-to-left, top-to-bottom)
            panels.sort(key=lambda p: (p["boundingBox"]["y"], -p["boundingBox"]["x"]))
            
            # Update reading order indices and reassign panel IDs based on sorted order
            reading_order = []
            for i, panel in enumerate(panels):
                panel["readingOrderIndex"] = i
                panel["id"] = f"panel_{i}"  # Reassign ID based on sorted order
                reading_order.append(i + 1)  # Use 1-based numbering for reading order
            
            return {
                "panels": panels,
                "totalPanels": len(panels),
                "originalImage": {
                    "width": int(original_width),
                    "height": int(original_height)
                },
                "readingOrder": reading_order
            }
        
        # Fallback to line-based detection with improved parameters
        im_height, im_width = cropped_im.shape[:2]
        
        # Improved parameters for better detection
        hough_threshold = 50  # Lower threshold for more sensitive detection
        hough_line_length = 30  # Shorter minimum line length
        hough_line_gap = 5  # Allow small gaps
        angle_deviation = 5  # Allow slight angle deviation
        distance = 999999999
        
        # More aggressive dynamic parameters
        width_border_factor = 0.05  # Smaller border
        height_border_factor = 0.05
        hor_line_length_factor = 0.2  # Shorter required line length
        ver_line_length_factor = 0.15
        parallel_merge_dst_factor = 0.15  # More aggressive merging
        
        # Calculate dynamic values
        width_border = int(width_border_factor * im_width)
        height_border = int(height_border_factor * im_height)
        hor_line_length = int(hor_line_length_factor * im_width)
        ver_line_length = int(ver_line_length_factor * im_height)
        parallel_merge_dst = int(parallel_merge_dst_factor * np.mean([im_width, im_height]))
        parallel_merge_dst = min(parallel_merge_dst, 80)  # Increased cap
        
        # Edge detection and line detection on cropped image
        grayscale = rgb2gray(cropped_im)
        edges = canny(grayscale, sigma=1.5, low_threshold=0.1, high_threshold=0.2)
        lines = probabilistic_hough_line(edges, threshold=hough_threshold, 
                                       line_length=hough_line_length, 
                                       line_gap=hough_line_gap)
        
        # Filter lines by angle (orthogonals only with some tolerance)
        segment_lines = []
        for line in lines:
            line_angle = protractor(line)
            if (abs(line_angle - 90) <= angle_deviation) or (abs(line_angle - 0) <= angle_deviation) or (abs(line_angle - 180) <= angle_deviation):
                segment_lines.append(line)
        
        # Merge inline segments
        for segment_line in segment_lines[:]:
            for segment_line2 in segment_lines[:]:
                if segment_line != segment_line2:
                    if in_line(segment_line, segment_line2, 1):  # horizontal
                        new_line = merge_line(segment_line, segment_line2, 1, distance)
                        if new_line != segment_line:
                            if segment_line in segment_lines:
                                segment_lines.remove(segment_line)
                            if segment_line2 in segment_lines:
                                segment_lines.remove(segment_line2)
                            segment_lines.append(new_line)
        
        for segment_line in segment_lines[:]:
            for segment_line2 in segment_lines[:]:
                if segment_line != segment_line2:
                    if in_line(segment_line, segment_line2, 0):  # vertical
                        new_line = merge_line(segment_line, segment_line2, 0, distance)
                        if new_line != segment_line:
                            if segment_line in segment_lines:
                                segment_lines.remove(segment_line)
                            if segment_line2 in segment_lines:
                                segment_lines.remove(segment_line2)
                            segment_lines.append(new_line)
        
        # Filter lines by length
        cutting_lines = []
        for line in segment_lines:
            if ((protractor(line) < 45 and line_len(line) >= hor_line_length) or 
                (protractor(line) > 45 and line_len(line) >= ver_line_length)):
                cutting_lines.append(line)
        
        # Extract horizontal and vertical cutting positions
        horizontal_c_pos = []
        vertical_c_pos = []
        
        for cutting_line in cutting_lines:
            if protractor(cutting_line) < 45:  # horizontal
                (p0c, p0r), (p1c, p1r) = cutting_line
                if (p0r > height_border) and (p0r < im_height - height_border):
                    horizontal_c_pos.append(p0r)
            else:  # vertical
                (p0c, p0r), (p1c, p1r) = cutting_line
                if (p0c > width_border) and (p0c < im_width - width_border):
                    lower_b, upper_b = min(p0r, p1r), max(p0r, p1r)
                    vertical_c_pos.append((p0c, lower_b, upper_b))
        
        # Merge parallel lines
        horizontal_c_pos = new_parallel_merge(horizontal_c_pos, parallel_merge_dst)
        
        # Create full-width horizontal lines
        horizontal_c_lines = []
        for hpos in horizontal_c_pos:
            horizontal_c_lines.append(((0, hpos), (im_width - 1, hpos)))
        
        # Process vertical lines with bounds
        horizontal_c_pos.insert(0, 0)
        horizontal_c_pos.append(im_height - 1)
        horizontal_c_pos.append(im_height - 1)
        
        # Adjust vertical line bounds based on horizontal lines
        for vpos_itr in range(len(vertical_c_pos)):
            for itr in range(len(horizontal_c_pos) - 1):
                if (vertical_c_pos[vpos_itr][1] >= horizontal_c_pos[itr] and 
                    vertical_c_pos[vpos_itr][1] < horizontal_c_pos[itr + 1]):
                    vertical_c_pos[vpos_itr] = (vertical_c_pos[vpos_itr][0], 
                                              horizontal_c_pos[itr], 
                                              vertical_c_pos[vpos_itr][2])
                
                if (vertical_c_pos[vpos_itr][2] <= horizontal_c_pos[itr + 1] and 
                    vertical_c_pos[vpos_itr][2] > horizontal_c_pos[itr]):
                    vertical_c_pos[vpos_itr] = (vertical_c_pos[vpos_itr][0], 
                                              vertical_c_pos[vpos_itr][1], 
                                              horizontal_c_pos[itr + 1])
        
        # Merge parallel vertical lines
        vertical_c_pos.sort(key=lambda a: a[0])
        if vertical_c_pos:
            c_pos_range = [vertical_c_pos[0][0]]
            for i in range(len(vertical_c_pos)):
                if abs(vertical_c_pos[i][0] - np.mean(c_pos_range)) <= parallel_merge_dst:
                    new_c_pos = int(np.mean(c_pos_range))
                    vertical_c_pos[i] = (new_c_pos, vertical_c_pos[i][1], vertical_c_pos[i][2])
                else:
                    c_pos_range = [vertical_c_pos[i][0]]
        
        # Create vertical cutting lines
        vertical_c_lines = []
        for vpos in vertical_c_pos:
            vertical_c_lines.append(((vpos[0], vpos[1]), (vpos[0], vpos[2])))
        
        # Generate panels with proper coordinates first
        panel_candidates = []
        
        # Remove duplicate horizontal positions
        horizontal_c_pos = list(set(horizontal_c_pos))
        horizontal_c_pos.sort()
        
        for i in range(len(horizontal_c_pos) - 1):
            try:
                if verticalcuts(horizontal_c_pos[i], horizontal_c_pos[i + 1], vertical_c_lines):
                    cutting_points = verticalcuts(horizontal_c_pos[i], horizontal_c_pos[i + 1], vertical_c_lines)
                    cutting_points.insert(0, 0)
                    cutting_points.append(im_width - 1)
                    cutting_points = sorted(list(set(cutting_points)))
                    
                    # Create panels for each column in this row
                    for j in range(len(cutting_points) - 1):
                        y1, y2 = horizontal_c_pos[i], horizontal_c_pos[i + 1]
                        x1, x2 = cutting_points[j], cutting_points[j + 1]
                        
                        # Adjust coordinates back to original image space
                        orig_x1, orig_y1 = x1 + crop_x, y1 + crop_y
                        orig_x2, orig_y2 = x2 + crop_x, y2 + crop_y
                        
                        # Extract panel image from original
                        panel_img = im[orig_y1:orig_y2, orig_x1:orig_x2]
                        
                        # Convert to base64
                        pil_img = Image.fromarray(panel_img)
                        buffer = BytesIO()
                        pil_img.save(buffer, format='JPEG')
                        panel_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
                        
                        panel_candidates.append({
                            "boundingBox": {
                                "x": int(orig_x1),
                                "y": int(orig_y1),
                                "width": int(orig_x2 - orig_x1),
                                "height": int(orig_y2 - orig_y1)
                            },
                            "imageData": panel_base64,
                            "center_x": (orig_x1 + orig_x2) / 2,
                            "center_y": (orig_y1 + orig_y2) / 2
                        })
                else:
                    # Single panel for this horizontal section
                    y1, y2 = horizontal_c_pos[i], horizontal_c_pos[i + 1]
                    x1, x2 = 0, im_width - 1
                    
                    # Adjust coordinates back to original image space
                    orig_x1, orig_y1 = x1 + crop_x, y1 + crop_y
                    orig_x2, orig_y2 = x2 + crop_x, y2 + crop_y
                    
                    # Extract panel from original image
                    panel_img = im[orig_y1:orig_y2, orig_x1:orig_x2]
                    
                    pil_img = Image.fromarray(panel_img)
                    buffer = BytesIO()
                    pil_img.save(buffer, format='JPEG')
                    panel_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
                    
                    panel_candidates.append({
                        "boundingBox": {
                            "x": int(orig_x1),
                            "y": int(orig_y1),
                            "width": int(orig_x2 - orig_x1),
                            "height": int(orig_y2 - orig_y1)
                        },
                        "imageData": panel_base64,
                        "center_x": (orig_x1 + orig_x2) / 2,
                        "center_y": (orig_y1 + orig_y2) / 2
                    })
            except (ValueError, IndexError):
                continue
        
        # Sort panels for proper manga reading order (right-to-left, top-to-bottom)
        # First sort by Y position (top to bottom), then by X position (right to left)
        panel_candidates.sort(key=lambda p: (p["center_y"], -p["center_x"]))
        
        # Create final panels with proper IDs and reading order
        panels = []
        reading_order = []
        
        for order_ctr, panel_candidate in enumerate(panel_candidates):
            panel_data = {
                "id": f"panel_{order_ctr}",
                "boundingBox": panel_candidate["boundingBox"],
                "imageData": panel_candidate["imageData"],
                "readingOrderIndex": order_ctr
            }
            
            panels.append(panel_data)
            reading_order.append(order_ctr + 1)  # Use 1-based numbering for consistency
        
        # If no panels found, return the whole image as a single panel
        if not panels:
            pil_img = Image.fromarray(im)
            buffer = BytesIO()
            pil_img.save(buffer, format='JPEG')
            panel_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
            
            panels.append({
                "id": "panel_0",
                "boundingBox": {
                    "x": 0,
                    "y": 0,
                    "width": int(original_width),
                    "height": int(original_height)
                },
                "imageData": panel_base64,
                "readingOrderIndex": 0
            })
            reading_order = [1]
        
        result = {
            "panels": panels,
            "totalPanels": len(panels),
            "originalImage": {
                "width": int(original_width),
                "height": int(original_height)
            },
            "readingOrder": reading_order
        }
        
        return result
        
    except Exception as e:
        return {
            "error": str(e),
            "panels": [],
            "totalPanels": 0,
            "originalImage": {"width": 0, "height": 0},
            "readingOrder": []
        }

def main():
    """Main CLI interface"""
    # Check if data is provided via command line argument or stdin
    if len(sys.argv) == 2:
        # Command line argument (for backward compatibility)
        image_base64 = sys.argv[1]
    else:
        # Read from stdin (for large data to avoid ENAMETOOLONG)
        try:
            image_base64 = sys.stdin.read().strip()
            if not image_base64:
                print(json.dumps({"error": "No input data provided", "panels": [], "totalPanels": 0, "originalImage": {"width": 0, "height": 0}, "readingOrder": []}))
                sys.exit(1)
        except Exception as e:
            print(json.dumps({"error": f"Failed to read input: {str(e)}", "panels": [], "totalPanels": 0, "originalImage": {"width": 0, "height": 0}, "readingOrder": []}))
            sys.exit(1)
    
    result = segment_manga_panels(image_base64)
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()
