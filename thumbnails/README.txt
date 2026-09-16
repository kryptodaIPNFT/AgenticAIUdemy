Lesson thumbnail images (custom placeholders)
=============================================

Each lesson thumbnail is matched to its video by filename (without extension).

Video file              Thumbnail file (any one format)
----------------        --------------------------------
videos/1 (1).mp4   -->  thumbnails/1 (1).jpg
                        thumbnails/1 (1).png
                        thumbnails/1 (1).webp
                        thumbnails/1 (1).svg

Supported formats: .webp, .jpg, .jpeg, .png, .svg
(Priority is top-to-bottom — .webp wins if multiple exist.)

First run
---------
When the server lists lessons, it auto-creates a branded placeholder SVG
for any video that does not yet have a thumbnail file.

Replace a thumbnail
-------------------
1. Drop your image into this folder using the SAME base name as the video.
   Example: for "Lesson 3.mp4", save as "Lesson 3.jpg"
2. Refresh the student dashboard — no server restart needed.
3. To replace an auto-generated .svg, add a .jpg/.png/.webp with the same
   name; the server prefers raster formats over .svg.

Recommended size: 640 x 360 px (16:9) or larger.

Default fallback: default.svg (used only if a specific file is missing)
